/**
 * A Mail template's version history as the panel shows it (ticket 14, stories
 * 37–39; ADR-0046): every version newest first, who wrote it and how it
 * stands, any two side by side as rendered mail, and any one restored as a
 * new draft. The editor's stale comparison and the read-only page name a
 * version the same way (`versionLine`).
 *
 * Every change writes a version (tickets 04 and 07): an operator's save is a
 * draft until published, a Template seed's is published at once, and a
 * template's first version was made by the migration from the row it had —
 * with no author on record, timed at the row's last write. The API's list
 * route pages like the others (`_start`/`_end`, `X-Total-Count`) and filters
 * by state (`published`, `draft` with discarded drafts flagged, `all`).
 */
import type { ApiClient } from "../api/client";
import { formatClubTime } from "../format";
import { pageRange, readOption, readPage, viewHref } from "../list-view";
import { referencedVariables } from "../mail-render/go-template";
import type { VersionProblem } from "../template-editor/refusals";
import {
  AUTHORING_MODE_LABEL,
  authorName,
  fetchVersionPage,
  writtenBy,
  type TemplateVersion,
  type TemplateVersionSummary,
  type VersionAuthor,
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

const DEFAULT_STATE: HistoryState = "all";

/** The view an address asks for; anything it does not recognise falls back to the default. */
export function readHistoryView(params: URLSearchParams): HistoryView {
  return { state: readOption(params, "state", HISTORY_FILTERS, DEFAULT_STATE), page: readPage(params) };
}

/** The address of `view` on `pathname`, leaving the defaults out. */
export function historyViewHref(pathname: string, view: HistoryView): string {
  return viewHref(pathname, { state: [view.state, DEFAULT_STATE], page: [view.page, 1] });
}

export function historyQuery(view: HistoryView): VersionPageQuery {
  return { state: view.state, ...pageRange(view.page, HISTORY_PAGE_SIZE) };
}

/** Who wrote a version, in the words every template screen uses: "sen" for the viewer. */
export function authorLabel(author: VersionAuthor, viewerSub: string | null): string {
  if (author.kind === "template_seed") return "Template seed";
  return writtenBy(author, viewerSub) ? "sen" : authorName(author);
}

/** Who wrote a version, as the history names them. */
export type VersionAuthorShown = Readonly<{
  label: string;
  /** `unknown`: an operator whose name was not recorded. */
  kind: "seed" | "operator" | "unknown";
  /**
   * The migration's first version: its content predates the history, so its
   * author was never recorded and its time is the template's last change
   * before versions were kept.
   */
  beforeHistory: boolean;
}>;

export function versionAuthor(version: Pick<TemplateVersionSummary, "seq" | "author">, viewerSub: string | null): VersionAuthorShown {
  const { author } = version;
  const beforeHistory = version.seq === 1 && author.sub === null;
  const kind = author.kind === "template_seed" ? "seed" : author.name?.trim() || writtenBy(author, viewerSub) ? "operator" : "unknown";
  return { label: authorLabel(author, viewerSub), kind, beforeHistory };
}

/**
 * When a version was written, and published if it was, in the club's time
 * (Europe/Istanbul) whatever the browser's zone.
 */
export function versionWhen(version: Pick<TemplateVersionSummary, "created_at" | "published_at">): string {
  const written = formatClubTime(version.created_at);
  if (version.published_at === null) return `yazıldı ${written}`;
  const published = formatClubTime(version.published_at);
  return published === written ? `yayımlandı ${published}` : `yazıldı ${written} · yayımlandı ${published}`;
}

/** "#4 · Mehmet Kaya · yayımlandı 23 Eyl 2026 10:12": one version, as every template screen names it. */
export function versionLine(
  version: Pick<TemplateVersionSummary, "seq" | "author" | "created_at" | "published_at">,
  viewerSub: string | null,
): string {
  return `#${version.seq} · ${authorLabel(version.author, viewerSub)} · ${versionWhen(version)}`;
}

/**
 * How a version stands: the one being sent, published before, a draft, or a
 * draft its author gave up. A draft is someone's draft in progress only while
 * it is their newest version (the template's `drafts`); one they have since
 * saved over stays in the history, restorable. A draft started from a version
 * that is no longer published is stale (ticket 07).
 */
export type VersionState = "sent" | "published" | "draft" | "stale" | "discarded";

export type VersionBadge = Readonly<{ state: VersionState; label: string; inProgress: boolean }>;

/** What a version's standing is read against: the template, as one source for every screen. */
export type Standing = Readonly<{
  /** The version sent: the template's `published_version_id`. */
  publishedVersionId: string | null;
  /** The template's drafts in progress. */
  draftsInProgress: readonly string[];
}>;

export function versionBadge(
  version: Pick<TemplateVersionSummary, "id" | "published_at" | "discarded" | "base_version_id">,
  { publishedVersionId, draftsInProgress }: Standing,
): VersionBadge {
  if (version.id === publishedVersionId) return { state: "sent", label: "Gönderilen", inProgress: false };
  if (version.published_at !== null) return { state: "published", label: "Yayımlanmış", inProgress: false };
  if (version.discarded) return { state: "discarded", label: "Atılmış taslak", inProgress: false };
  const inProgress = draftsInProgress.includes(version.id);
  if (version.base_version_id !== publishedVersionId) return { state: "stale", label: "Bayat taslak", inProgress };
  return { state: "draft", label: inProgress ? "Süren taslak" : "Taslak", inProgress };
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

/** One row of the history: a version, and the earlier saves folded under it. */
export type HistoryRow = Readonly<{ version: TemplateVersionSummary; earlier: readonly TemplateVersionSummary[] }>;

/** Two drafts one operator saved, one after the other, on the same published version. */
function sameRun(a: TemplateVersionSummary, b: TemplateVersionSummary): boolean {
  return (
    a.published_at === null &&
    b.published_at === null &&
    a.author.kind === "operator" &&
    a.author.sub !== null &&
    a.author.sub === b.author.sub &&
    a.base_version_id === b.base_version_id
  );
}

/**
 * The listed versions as rows: consecutive drafts one operator saved on the
 * same base read as one row, the newest on top and the earlier saves under
 * it (ticket 07: every save is a version). Within the page shown.
 */
export function historyRows(versions: readonly TemplateVersionSummary[]): HistoryRow[] {
  const rows: { version: TemplateVersionSummary; earlier: TemplateVersionSummary[] }[] = [];
  for (const version of versions) {
    const last = rows.at(-1);
    if (last && sameRun(last.earlier.at(-1) ?? last.version, version)) last.earlier.push(version);
    else rows.push({ version, earlier: [] });
  }
  return rows;
}

/**
 * Two versions to put side by side. The second is named, or is the version
 * published before a given one, which only the API can say.
 */
export type ComparisonRequest =
  | Readonly<{ versionId: string; againstId: string }>
  | Readonly<{ versionId: string; publishedBefore: number }>;

/**
 * What a version is compared with when the operator asks for no other: the
 * version being sent — what publishing or restoring it would replace. The
 * version being sent itself is compared with the one it started from, which
 * shows what it changed; one that started from nothing (a Template seed's)
 * with the version published before it. A template's first version has
 * nothing before it.
 */
export function defaultComparison(
  version: Pick<TemplateVersionSummary, "id" | "seq" | "base_version_id">,
  sentId: string | null,
): ComparisonRequest | null {
  if (sentId !== null && version.id !== sentId) return { versionId: version.id, againstId: sentId };
  if (version.base_version_id !== null) return { versionId: version.id, againstId: version.base_version_id };
  return version.seq > 1 ? { versionId: version.id, publishedBefore: version.seq } : null;
}

const PUBLISHED_PAGE = 50;

/**
 * The published version written last before `seq`, asked of the API's
 * published versions page by page (newest first), whatever the history shows.
 */
export async function fetchPublishedBefore(
  api: ApiClient,
  templateId: string,
  seq: number,
  signal?: AbortSignal,
): Promise<TemplateVersionSummary | null> {
  for (let start = 0; ; start += PUBLISHED_PAGE) {
    const query: VersionPageQuery = { state: "published", _start: start, _end: start + PUBLISHED_PAGE };
    const { versions, total } = await fetchVersionPage(api, templateId, query, signal);
    const before = versions.find((version) => version.seq < seq);
    if (before) return before;
    if (versions.length < PUBLISHED_PAGE || (total !== null && query._end >= total)) return null;
  }
}

/** The two in the order they were written: the older on the left. */
export function inSeqOrder<T extends { seq: number }>(a: T, b: T): [T, T] {
  return a.seq <= b.seq ? [a, b] : [b, a];
}

/** Picks a version to compare, or unpicks it; a third pick lets go of the first. */
export function togglePick<T extends { id: string }>(picked: readonly T[], version: T): T[] {
  if (picked.some((other) => other.id === version.id)) return picked.filter((other) => other.id !== version.id);
  return [...picked, version].slice(-2);
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
export type RestoreOutcome = Readonly<{ text: string; openEditor: boolean }>;

/**
 * Reads the restore's answer by its status (ticket 07): 201 wrote a new
 * draft; 200 wrote nothing and answers the version the copy would have
 * repeated — the viewer's draft in progress, or the published version.
 */
export function restoreOutcome(
  answer: { status: number; version: Pick<TemplateVersion, "seq" | "published_at"> },
  from: { seq: number },
): RestoreOutcome {
  const { status, version } = answer;
  if (status === 201) {
    return {
      openEditor: true,
      text: `Sürüm #${from.seq} yeni bir taslak olarak geri getirildi (#${version.seq}). Canlı mail değişmedi; yayımlayana kadar gönderilen sürüm aynı kalır.`,
    };
  }
  if (version.published_at !== null) {
    return { openEditor: false, text: `Sürüm #${from.seq}, şu an gönderilen sürümle aynı; yeni taslak açılmadı.` };
  }
  return {
    openEditor: true,
    text: `Süren taslağın (#${version.seq}) zaten sürüm #${from.seq} ile aynı; yeni taslak açılmadı. Canlı mail değişmedi.`,
  };
}

/**
 * Whether a refused restore would be refused again as it is: the copy itself
 * drops a Required variable or does not parse. Anything else — the network,
 * the server — may pass on a retry.
 */
export function isFinalRestoreRefusal(problem: VersionProblem): boolean {
  return problem.kind === "missing-variables" || problem.kind === "unparseable";
}
