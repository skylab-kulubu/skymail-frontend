/**
 * "Haberden gönder" (hub ticket duyuru-haber 08): a published News record of
 * inscribed mailed to every member or to some teams, through skymail-backend's
 * /news_sends routes (tickets 06 and 07).
 *
 * The panel, the site and SkyMail's own "Yeni gönderim" open the same form:
 * `/mail-tasks/create?source=news&slug=<slug>`. The backend reads the record,
 * renders the club.news template, asks core who it reaches and queues it; the
 * form only says which record, to whom, how, and shows what would go out.
 * Only skymail:announcements:send sends at once; skymail:mails:write may
 * prepare one (preview, test mail, count). Mail onayı for news sends comes
 * with a later backend version.
 */
import { ROLE, hasRole } from "./access";
import type { ApiClient } from "./api/client";
import type { ListRow } from "./mailing-lists";
import { SEND_LIST_PATH } from "./sends";
import { COMMERCIAL_STATEMENT } from "./send-form/purpose";

/** Sends to everyone at once (skymail-backend handlers.AnnouncementsSendRole). */
export const ANNOUNCEMENTS_SEND_ROLE = "skymail:announcements:send";

export const NEWS_SLUG_MAX = 200;
export const NEWS_SUBJECT_MAX = 200;
export const NEWS_PREHEADER_MAX = 300;
export const NEWS_TEAMS_MAX = 32;

export type NewsAudienceType = "members" | "teams";
export type NewsFormat = "full" | "summary";

export type NewsDraft = Readonly<{
  slug: string;
  audience: Readonly<{ type: NewsAudienceType; teams: readonly string[] }>;
  format: NewsFormat;
  /** Empty: the record's title (a duyuru's after "Duyuru: "). */
  subject: string;
  /** Empty: the record's summary. */
  preheader: string;
  /** The sender's statement that the mail's main purpose is not promotion (COMMERCIAL_STATEMENT). */
  statement: boolean;
  tracking: boolean;
}>;

export function emptyNewsDraft(slug: string): NewsDraft {
  return { slug, audience: { type: "members", teams: [] }, format: "full", subject: "", preheader: "", statement: false, tracking: false };
}

/** `requests.SendNews`. */
export type NewsSendRequest = Readonly<{
  slug: string;
  audience: Readonly<{ type: NewsAudienceType; teams: string[] }>;
  format: NewsFormat;
  subject: string;
  preheader: string;
  commercial_content_absent: boolean;
  tracking: boolean;
}>;

/** `handlers.NewsSendAvailability`. */
export type NewsAvailability = Readonly<{ available: boolean; read_more: "home" | "pages" }>;

/** `mailer.Rendered`: the mail as the send would queue it, for the caller as its reader. */
export type RenderedNewsMail = Readonly<{ subject: string; plain_text: string; html: string }>;

export type NewsSendSource = Readonly<{ ref: string; slug: string; version: number; kind: "haber" | "duyuru" }>;

export type NewsSendCounts = Readonly<{
  members: number;
  followers: number;
  total: number;
  already_received: number;
  skipped: Readonly<{
    not_member: number;
    not_visible: number;
    disabled: number;
    no_email: number;
    unverified: number;
    opted_out: number;
    duplicate_email: number;
    no_unsubscribe_url: number;
  }>;
}>;

/** `handlers.NewsSendCount`. */
export type NewsSendCount = Readonly<{
  counts: NewsSendCounts;
  /** The send of this record to this audience, when there is one: sending again is refused. */
  already_sent_task_id: string | null;
  source: NewsSendSource;
}>;

/** `handlers.NewsSendResult`. */
export type NewsSendResult = Readonly<{ id: string; source: NewsSendSource; queued: number; failed: number; counts: NewsSendCounts }>;

/** The send form opened on a News record: the address the panel and the site link to. */
export function newsSendHref(slug: string): string {
  return `${SEND_LIST_PATH}/create?${new URLSearchParams({ source: "news", slug })}`;
}

/**
 * The record an address asks to mail: null when the address is not a News
 * send's; an empty slug asks for one to be typed in.
 */
export function readNewsSendQuery(params: URLSearchParams): { slug: string } | { problem: string } | null {
  if (params.get("source") !== "news") return null;
  const slug = params.get("slug")?.trim() ?? "";
  if (slug.length > NEWS_SLUG_MAX) return { problem: `Haber adresi (slug) en çok ${NEWS_SLUG_MAX} karakter olabilir.` };
  return { slug };
}

export function newsAccess(roles: readonly string[]): { prepare: boolean; send: boolean } {
  const send = roles.includes(ANNOUNCEMENTS_SEND_ROLE);
  return { prepare: send || hasRole(roles, ROLE.mailsWrite), send };
}

function audienceOf(draft: NewsDraft): NewsSendRequest["audience"] {
  return draft.audience.type === "members" ? { type: "members", teams: [] } : { type: "teams", teams: [...draft.audience.teams] };
}

export function newsSendRequest(draft: NewsDraft): NewsSendRequest {
  return {
    slug: draft.slug.trim(),
    audience: audienceOf(draft),
    format: draft.format,
    subject: draft.subject.trim(),
    preheader: draft.preheader.trim(),
    commercial_content_absent: draft.statement,
    tracking: draft.tracking,
  };
}

export function newsCountRequest(draft: NewsDraft): Pick<NewsSendRequest, "slug" | "audience"> {
  return { slug: draft.slug.trim(), audience: audienceOf(draft) };
}

export function fetchNewsAvailability(api: ApiClient, signal?: AbortSignal): Promise<NewsAvailability> {
  return api.get<NewsAvailability>("/news_sends/availability", { signal });
}

export function previewNewsMail(api: ApiClient, draft: NewsDraft, signal?: AbortSignal): Promise<RenderedNewsMail> {
  return api.post<RenderedNewsMail>("/news_sends/preview", newsSendRequest(draft), { signal });
}

export function fetchNewsCount(api: ApiClient, draft: NewsDraft, signal?: AbortSignal): Promise<NewsSendCount> {
  return api.post<NewsSendCount>("/news_sends/count", newsCountRequest(draft), { signal });
}

export function testNewsMail(api: ApiClient, draft: NewsDraft): Promise<{ id: string }> {
  return api.post<{ id: string }>("/news_sends/test", newsSendRequest(draft));
}

export function sendNews(api: ApiClient, draft: NewsDraft): Promise<NewsSendResult> {
  return api.post<NewsSendResult>("/news_sends", newsSendRequest(draft));
}

/** A team: a Keycloak group under /UYELER, as the mailing list routes list it. */
export const TEAM_ROOT = "/UYELER/";

/**
 * The teams to pick from: the Keycloak groups among the mailing lists whose
 * path is under /UYELER (core refuses any other, news_send.team_unknown).
 * A team's sub-teams and followers come with it (core).
 */
export function teamOptions(lists: readonly ListRow[]): Array<{ value: string; label: string; hint: string }> {
  return lists
    .filter((list) => list.external && list.groupPath?.startsWith(TEAM_ROOT))
    .map((list) => ({ value: list.id, label: list.name, hint: list.groupPath ?? "" }));
}

/** The links a rendered mail carries, each once, in the order they appear: the review lists them. */
export function mailLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const href = (match[1] ?? match[2] ?? "").replace(/&amp;/g, "&").trim();
    if (href) links.add(href);
  }
  return [...links];
}

export type CountPart = Readonly<{ key: string; label: string; value: number }>;

/**
 * The live count's breakdown: who it reaches (members, followers) and who it
 * leaves out. The ticket's five are always shown; the rest only when not 0.
 */
export function countParts(count: NewsSendCount): CountPart[] {
  const { counts } = count;
  const always: CountPart[] = [
    { key: "members", label: "Üyeler", value: counts.members },
    { key: "followers", label: "Takipçiler", value: counts.followers },
    { key: "opted_out", label: "Tercihi kapalı", value: counts.skipped.opted_out },
    { key: "not_visible", label: "Görünürlük dışı", value: counts.skipped.not_visible },
    { key: "already_received", label: "Zaten aldı", value: counts.already_received },
  ];
  const others: CountPart[] = [
    { key: "unverified", label: "Doğrulanmamış", value: counts.skipped.unverified },
    { key: "disabled", label: "Devre dışı", value: counts.skipped.disabled },
    { key: "no_email", label: "Adresi yok", value: counts.skipped.no_email },
    { key: "not_member", label: "Üye değil", value: counts.skipped.not_member },
    { key: "duplicate_email", label: "Aynı adres", value: counts.skipped.duplicate_email },
  ];
  return [...always, ...others.filter((part) => part.value > 0)];
}

/**
 * count, when it was counted for draft's record and audience (counted is the
 * draft it was asked for); null while it is an older audience's, so a send
 * never goes on the number of the audience just changed.
 */
export function countFor(draft: NewsDraft, counted: NewsDraft, count: NewsSendCount | null): NewsSendCount | null {
  return JSON.stringify(newsCountRequest(draft)) === JSON.stringify(newsCountRequest(counted)) ? count : null;
}

/** What stops "Şimdi gönder", in the order the form reads; empty when nothing does. */
export function sendProblems(draft: NewsDraft, count: NewsSendCount | null): string[] {
  const problems: string[] = [];
  if (draft.audience.type === "teams") {
    if (draft.audience.teams.length === 0) problems.push("Ekiplere gönderimde en az bir ekip seç.");
    else if (draft.audience.teams.length > NEWS_TEAMS_MAX) problems.push(`Bir gönderimde en çok ${NEWS_TEAMS_MAX} ekip seçilebilir.`);
  }
  if (draft.subject.trim().length > NEWS_SUBJECT_MAX) problems.push(`Konu en çok ${NEWS_SUBJECT_MAX} karakter olabilir.`);
  if (draft.preheader.trim().length > NEWS_PREHEADER_MAX) problems.push(`Önizleme metni en çok ${NEWS_PREHEADER_MAX} karakter olabilir.`);
  if (!draft.statement) problems.push(`Beyan kutusunu işaretle: “${COMMERCIAL_STATEMENT}”`);
  if (!count) problems.push("Alıcı sayısı henüz gelmedi.");
  else if (count.already_sent_task_id) problems.push("Bu haber bu kitleye zaten gönderildi.");
  else if (count.counts.total - count.counts.already_received <= 0) problems.push("Bu kitlede gönderilecek kimse yok.");
  return problems;
}
