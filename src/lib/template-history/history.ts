/**
 * A Mail template's version history as the panel shows it (ticket 14, stories
 * 37–39; ADR-0046): every version newest first, who wrote it and how it
 * stands, any two side by side as rendered mail, and any one restored as a
 * new draft.
 *
 * Every change writes a version (tickets 04 and 07): an operator's save is a
 * draft until published, a Template seed's is published at once, and a
 * template's first version was made by the migration from the row it had —
 * with no author on record, timed at the row's last write. The API's list
 * route pages like the others (`_start`/`_end`, `X-Total-Count`) and filters
 * by state (`published`, `draft` with discarded drafts flagged, `all`).
 */
import { pageRange } from "../list-view";
import { referencedVariables } from "../mail-render/go-template";
import { formatSendTime } from "../sends";
import {
  AUTHORING_MODE_LABEL,
  UNKNOWN_AUTHOR,
  writtenBy,
  type TemplateVersion,
  type TemplateVersionSummary,
  type VersionPageQuery,
} from "../templates";

export const HISTORY_PAGE_SIZE = 20;

export type HistoryState = VersionPageQuery["state"];

/** The Hepsi · Yayımlanmış · Taslak filter, in the order it is shown. */
export const HISTORY_FILTERS: ReadonlyArray<{ value: HistoryState; label: string }> = [
  { value: "all", label: "Hepsi" },
  { value: "published", label: "Yayımlanmış" },
  { value: "draft", label: "Taslak" },
];

/** Which versions and which page, kept in the page's address (`?state=draft&page=2`). */
export type HistoryView = Readonly<{ state: HistoryState; page: number }>;

const DEFAULT_VIEW: HistoryView = { state: "all", page: 1 };

/** The view an address asks for; anything it does not recognise falls back to the default. */
export function readHistoryView(params: URLSearchParams): HistoryView {
  const state = HISTORY_FILTERS.find((filter) => filter.value === params.get("state"))?.value ?? DEFAULT_VIEW.state;
  const raw = params.get("page");
  const page = raw !== null && /^\d+$/.test(raw) && Number(raw) >= 1 ? Number(raw) : DEFAULT_VIEW.page;
  return { state, page };
}

/** The address of `view` on `pathname`, leaving the defaults out. */
export function historyViewHref(pathname: string, view: HistoryView): string {
  const params = new URLSearchParams();
  if (view.state !== DEFAULT_VIEW.state) params.set("state", view.state);
  if (view.page !== DEFAULT_VIEW.page) params.set("page", String(view.page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function historyQuery(view: HistoryView): VersionPageQuery {
  return { state: view.state, ...pageRange(view.page, HISTORY_PAGE_SIZE) };
}

/** Who wrote a version, as the history names them. */
export type VersionAuthorShown = Readonly<{
  label: string;
  /** `unknown`: an operator whose name was not recorded. */
  kind: "seed" | "operator" | "unknown";
  mine: boolean;
  /**
   * The migration's first version: its content predates the history, so its
   * author was never recorded and its time is the template's last change
   * before versions were kept.
   */
  beforeHistory: boolean;
}>;

type Authored = Pick<TemplateVersionSummary, "seq" | "author">;

export function versionAuthor(version: Authored, viewerSub: string | null): VersionAuthorShown {
  const { author } = version;
  const beforeHistory = version.seq === 1 && author.sub === null;
  if (author.kind === "template_seed") return { label: "Template seed", kind: "seed", mine: false, beforeHistory };
  const name = author.name?.trim();
  const mine = writtenBy(author, viewerSub);
  if (!name) return { label: UNKNOWN_AUTHOR, kind: "unknown", mine, beforeHistory };
  return { label: mine ? `${name} (sen)` : name, kind: "operator", mine, beforeHistory };
}

/**
 * How a version stands: the one being sent, published before, a draft, or a
 * draft its author gave up. A draft is someone's draft in progress only while
 * it is their newest version (the template's `drafts`); one they have since
 * saved over stays in the history, restorable.
 */
export type VersionState = "sent" | "published" | "draft" | "discarded";

export type VersionBadge = Readonly<{ state: VersionState; label: string; inProgress: boolean }>;

type Standing = Pick<TemplateVersionSummary, "id" | "current" | "published_at" | "discarded">;

export function versionBadge(version: Standing, draftsInProgress: Iterable<string>): VersionBadge {
  if (version.current) return { state: "sent", label: "Gönderilen", inProgress: false };
  if (version.published_at !== null) return { state: "published", label: "Yayımlanmış", inProgress: false };
  if (version.discarded) return { state: "discarded", label: "Atılmış taslak", inProgress: false };
  const inProgress = [...draftsInProgress].includes(version.id);
  return { state: "draft", label: inProgress ? "Süren taslak" : "Taslak", inProgress };
}

/**
 * When a version was written, and published if it was, in the club's time
 * (Europe/Istanbul, as sends are shown) whatever the browser's zone.
 */
export function versionWhen(version: Pick<TemplateVersionSummary, "created_at" | "published_at">): string {
  const written = formatSendTime(version.created_at);
  if (version.published_at === null) return `yazıldı ${written}`;
  const published = formatSendTime(version.published_at);
  return published === written ? `yayımlandı ${published}` : `yazıldı ${written} · yayımlandı ${published}`;
}

/** The name a version gives the template, where it is not what the template is called now. */
export function versionName(version: Pick<TemplateVersionSummary, "name">, templateName: string): string | null {
  const name = version.name ?? null;
  return name !== null && name !== templateName ? name : null;
}

/**
 * The subject a Template seed asked for, where its version kept another: a
 * seed from before the seed's conflict rule kept an operator's subject.
 */
export function requestedSubject(version: Pick<TemplateVersionSummary, "subject" | "requested_subject">): string | null {
  const asked = version.requested_subject;
  return asked !== null && asked !== version.subject ? asked : null;
}

/** Two versions to put side by side. */
export type ComparisonRequest = Readonly<{ versionId: string; againstId: string }>;

type Listed = Pick<TemplateVersionSummary, "id" | "seq" | "base_version_id">;

/**
 * What a version is compared with when the operator asks for no other: the
 * version being sent — what publishing or restoring it would replace. The
 * version being sent itself is compared with the one it started from, which
 * shows what it changed; failing that, with the next older version listed.
 * A template's only version has nothing to be compared with.
 */
export function defaultComparison(version: Listed, sentId: string | null, listed: readonly Listed[]): ComparisonRequest | null {
  if (sentId !== null && version.id !== sentId) return { versionId: version.id, againstId: sentId };
  if (version.base_version_id !== null) return { versionId: version.id, againstId: version.base_version_id };
  const older = listed.filter((other) => other.seq < version.seq).sort((a, b) => b.seq - a.seq)[0];
  return older ? { versionId: version.id, againstId: older.id } : null;
}

/** The two in the order they were written: the older on the left. */
export function inSeqOrder<T extends { seq: number }>(a: T, b: T): [T, T] {
  return a.seq <= b.seq ? [a, b] : [b, a];
}

/** Picks a version to compare, or unpicks it; a third pick lets go of the first. */
export function togglePick(picked: readonly string[], id: string): string[] {
  if (picked.includes(id)) return picked.filter((other) => other !== id);
  return [...picked, id].slice(-2);
}

/** One thing a comparison says in words beside the rendered mails. */
export type ComparisonFact = Readonly<{
  label: string;
  /** Words the operator wrote, quoted; an Authoring mode, named; or the body, compared as rendered mail. */
  kind: "text" | "mode" | "body";
  /** Null where there is nothing to quote: a body is compared as rendered mail, not as text. */
  older: string | null;
  newer: string | null;
  same: boolean;
}>;

type Compared = Pick<TemplateVersion, "name" | "subject" | "main_mode" | "html_content" | "plain_text_content">;

export function comparisonFacts(older: Compared, newer: Compared): ComparisonFact[] {
  const fact = (label: string, kind: "text" | "mode", a: string | null, b: string | null): ComparisonFact => ({
    label,
    kind,
    older: a,
    newer: b,
    same: a !== null && a === b,
  });
  const mode = (version: Compared) => AUTHORING_MODE_LABEL[version.main_mode] ?? version.main_mode;
  return [
    fact("Ad", "text", older.name ?? null, newer.name ?? null),
    fact("Konu", "text", older.subject, newer.subject),
    fact("Main source", "mode", mode(older), mode(newer)),
    {
      label: "Gövde",
      kind: "body",
      older: null,
      newer: null,
      same: older.html_content === newer.html_content && older.plain_text_content === newer.plain_text_content,
    },
  ];
}

/**
 * The variables either body references, each once: both mails of a
 * comparison are filled with the same sample values, so only what differs
 * between the versions differs on screen.
 */
export function comparedVariables(...bodies: string[]): string[] {
  const names = new Set<string>();
  for (const body of bodies) {
    try {
      for (const name of referencedVariables(body)) names.add(name);
    } catch {
      // A body the scanner cannot read previews with placeholders.
    }
  }
  return [...names];
}

/** What a restore did, as the page says it, and whether the editor should open the result. */
export type RestoreOutcome = Readonly<{
  kind: "drafted" | "already-draft" | "already-sent";
  text: string;
  openEditor: boolean;
}>;

/**
 * Reads the restore's answer. A 201 is a new draft. A 200 is the version the
 * copy would have repeated: the viewer's draft in progress (`viewerDraftId`,
 * known before the restore) or the published version.
 */
export function restoreOutcome(
  restored: Pick<TemplateVersion, "id" | "seq" | "published_at">,
  from: { seq: number },
  viewerDraftId: string | null,
): RestoreOutcome {
  if (restored.published_at !== null) {
    return {
      kind: "already-sent",
      text: `Sürüm #${from.seq}, şu an gönderilen sürümle aynı; yeni taslak açılmadı.`,
      openEditor: false,
    };
  }
  if (restored.id === viewerDraftId) {
    return {
      kind: "already-draft",
      text: `Süren taslağın zaten sürüm #${from.seq} ile aynı; yeni taslak açılmadı. Canlı mail değişmedi.`,
      openEditor: true,
    };
  }
  return {
    kind: "drafted",
    text: `Sürüm #${from.seq} yeni bir taslak olarak geri getirildi (#${restored.seq}). Canlı mail değişmedi; yayımlayana kadar gönderilen sürüm aynı kalır.`,
    openEditor: true,
  };
}
