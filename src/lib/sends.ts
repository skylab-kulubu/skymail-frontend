/**
 * Sends — mail tasks — as the home screen, the send list and a send show
 * them: the shapes skymail-backend answers with, the addresses the screens
 * keep their view in, and the wording the panel puts on them.
 *
 * A send has no status of its own. The API derives one from its recipients'
 * queue rows (`mail_task_status`, skymail-backend PR #21): `failed` when any
 * recipient failed (or none was queued a minute after the send), `sending`
 * while any is pending or processing, `sent` otherwise. The summary and the
 * `?status=` filter use that one definition, so the failed tile on the home
 * screen always equals the failed list's total. The list, a send and the
 * summary's recent sends are the same object, audience included, so a
 * Keycloak group carries the same name on every screen.
 */
import type { ApiClient, ApiPage } from "./api/client";
import { ApiError } from "./api/errors";
import { CLUB_TIME_ZONE, formatClubTime } from "./format";
import { pageRange } from "./list-view";
import { mailRecipientLabel, recipientLabel } from "./people";

export const SEND_PAGE_SIZE = 25;
export const RECIPIENT_PAGE_SIZE = 25;

export type SendStatus = "failed" | "sending" | "sent";
export type RecipientStatus = "pending" | "processing" | "sent" | "failed";

/**
 * Queue rows by status; each row is one mail to one recipient. `cancelled`
 * (skymail-backend, duyuru-haber 05 G4): pending recipients of a cancelled
 * send, in failed too; absent from a backend before it.
 */
export type RecipientCounts = Readonly<Record<RecipientStatus, number> & { cancelled?: number }>;

/**
 * A send's recipients by status, and what the suppression list did to them
 * (skymail-backend QueueTotals; missing from an older backend): undelivered
 * were sent and a report said the address does not exist (in sent);
 * suppressed were never sent (in failed); suppressed_but_sent were account
 * mail sent to a suppressed address anyway, flagged (in their status).
 */
export type SendRecipientCounts = RecipientCounts &
  Readonly<Partial<Record<"undelivered" | "suppressed" | "suppressed_but_sent", number>>>;

/** Who a send went to. Fields that do not apply to the kind are null. */
export type SendAudience = Readonly<{
  /** `people` only on a Mail onayı request to several (mail-approvals/approvals.ts): a send goes to one person or a list. */
  kind: "mailing_list" | "single" | "people" | "form";
  mail_list_id: string | null;
  /** A list's name; a Keycloak group's as Keycloak gave it, or null when it could not. */
  name: string | null;
  source: "internal" | "keycloak" | "forms" | null;
  recipient_full_name: string | null;
  recipient_email: string | null;
  form_source_id?: string;
  form_id?: string;
  recipient_count?: number;
  prepared_at?: string;
}>;

/** One send, as `GET /mail_tasks`, `GET /mail_tasks/:id` and the summary's recent sends all give it. */
export type Send = Readonly<{
  id: string;
  created_at: string;
  sent_by: string;
  template_id: string | null;
  template_name: string | null;
  template_key: string | null;
  mail_list_id: string | null;
  mail_list_name: string | null;
  audience: SendAudience;
  status: SendStatus;
  recipient_counts: SendRecipientCounts;
  /**
   * Whether the viewer may open the send's content (skymail-backend, sent mail
   * content): its recipients' mails as they were sent. Missing from a backend
   * that cannot show content.
   */
  content_access?: ContentAccess;
  /** When the content is emptied; null unless content_access is available or masked. */
  content_expires_at?: string | null;
  /**
   * Whether the send asked for open and click tracking and got it (SkyMail's
   * tracking was on, and its template may be tracked). Missing from a backend
   * before tracking.
   */
  tracking?: boolean;
  /** While set, its pending recipients wait (send-controls.ts); absent from a backend before task controls. */
  paused_at?: string | null;
  /** `operator`: paused by hand; `failure_rate`: paused itself as its recipients failed past the threshold. */
  paused_reason?: "operator" | "failure_rate" | null;
  /** When the send was cancelled: its pending recipients were skipped. */
  cancelled_at?: string | null;
}>;

/**
 * Whether a send's content can be opened, and if not why (skymail-backend,
 * sent mail content). `masked`: mail that may carry a code or a one-time link,
 * shown whole with every code and one-time link replaced by `••••••` on the
 * server (Yusuf, 2026-10-13); `restricted` is shown to others (its sender,
 * those who send to lists for a send to many, SkyMail's administrators);
 * `expired` is past the retention period, emptied; `not_kept` is mail of the
 * masked kind whose content was emptied (before such content was kept, or
 * because it could not be masked for certain); `pending` is such mail not
 * masked yet (the server masks it once the send is done), not shown;
 * `sensitive` (a backend from before masking) is shown to no one.
 */
export type ContentAccess = "available" | "masked" | "pending" | "sensitive" | "restricted" | "expired" | "not_kept";

/** Whether a send's recipients' mails open: as sent, or masked. */
export function contentOpens(access: ContentAccess | "unavailable" | undefined): boolean {
  return access === "available" || access === "masked";
}

/** What a masked value reads as: skymail-backend's mailer.Mask. */
export const MASK = "••••••";

/** Text cut where it shows a masked value, so each mask can be marked. */
export function maskedSegments(text: string): ReadonlyArray<{ text: string; masked: boolean }> {
  const segments: { text: string; masked: boolean }[] = [];
  text.split(MASK).forEach((part, index) => {
    if (index > 0) segments.push({ text: MASK, masked: true });
    if (part !== "") segments.push({ text: part, masked: false });
  });
  return segments;
}

/** `GET /mail_tasks/:id/queue/:rowId/content`: one recipient's mail as it was sent. */
export type SentContent = Readonly<{
  id: string;
  task_id: string;
  /** `unavailable`: nothing kept for this recipient (Account erasure emptied it, or it never rendered). */
  access: ContentAccess | "unavailable";
  subject: string | null;
  plain_text: string | null;
  /** Masked, each masked value in the text is `<mark data-skymail-masked="">••••••</mark>`. */
  html: string | null;
  expires_at: string | null;
  /** Masked content: the send's variables masked (`link`, `code`, `answers[0].url`). */
  masked_variables?: readonly string[] | null;
  /** Masked content: `variables` (rendered again with them masked) or `patterns` (every link, long number and code masked). */
  masked_by?: "variables" | "patterns" | null;
}>;

/** `GET /mail_tasks/summary`. */
export type SendSummary = Readonly<{
  /** The zone `daily_sent`'s days are in. */
  time_zone: string;
  queue_counts: RecipientCounts;
  /**
   * True while `MAIL_SENDER=paused` holds the sender back, as during a restore
   * from backup (skymail-backend ticket 28): sends are queued, none goes out.
   * skymail-backend always gives it; senderPaused reads it missing as false.
   */
  sender_paused?: boolean;
  /** True while `SKYMAIL_TRACKING=on`: a send may ask for open and click tracking. Absent from a backend before tracking. */
  tracking_available?: boolean;
  /** True while `SKYMAIL_TRACKING_OPERATOR=on` too: every send a person makes is tracked and the form shows no box. Absent from a backend before it. */
  tracking_always?: boolean;
  /** True while `SKYMAIL_MAIL_PURPOSE=on`: a send carries its purpose and category (send-form/purpose.ts). Absent from a backend before it. */
  purpose_available?: boolean;
  /** True while `SKYMAIL_LIST_CONSENT=on`: a list's guests need their announcement consent unless the send states it is about the list's own event (send-form/purpose.ts). Absent from a backend before it. */
  list_consent_available?: boolean;
  /** Until when sends to lists, groups and News wait because the relay throttled the account (send-controls.ts); null or absent when not held. */
  bulk_held_until?: string | null;
  send_counts: Readonly<Record<SendStatus, number>>;
  /** Oldest first, ending today; `date` is a calendar day in `time_zone` (`YYYY-MM-DD`). */
  daily_sent: ReadonlyArray<Readonly<{ date: string; sent: number }>>;
  recent_sends: readonly Send[];
}>;

/** A row of `GET /mail_tasks/:id/queue`: one recipient of the send. */
export type RecipientRow = Readonly<{
  id: string;
  recipient_full_name: string;
  recipient_email: string;
  /** sqlc's NullMailQueueStatus. */
  status: Readonly<{ mail_queue_status: string; valid: boolean }> | null;
  error: string | null;
  attempts: number;
  next_attempt_at: string | null;
  created_at: string | null;
}>;

// ---------------------------------------------------------------------------
// Statuses

export const SEND_STATUS_LABEL: Readonly<Record<SendStatus, string>> = {
  sending: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Başarısız",
};

export const RECIPIENT_STATUS_LABEL: Readonly<Record<RecipientStatus, string>> = {
  pending: "Bekliyor",
  processing: "İşleniyor",
  sent: "Gönderildi",
  failed: "Başarısız",
};

const RECIPIENT_STATUSES: readonly RecipientStatus[] = ["pending", "processing", "sent", "failed"];

function asRecipientStatus(value: string | null | undefined): RecipientStatus | null {
  return RECIPIENT_STATUSES.find((status) => status === value) ?? null;
}

/** A queue row's status; a row without one is pending, as the queue's default is. */
export function recipientStatus(raw: RecipientRow["status"]): RecipientStatus {
  return (raw?.valid ? asRecipientStatus(raw.mail_queue_status) : null) ?? "pending";
}

function pageFromSearch(raw: string | null): number {
  const value = raw?.trim() ?? "";
  return /^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : 1;
}

function withSearch(path: string, status: string, page: number): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

// ---------------------------------------------------------------------------
// The send list: /mail-tasks?status=failed&page=2

export const SEND_LIST_PATH = "/mail-tasks";

export type SendFilter = SendStatus | "all";
export type SendListView = Readonly<{ status: SendFilter; page: number }>;

export const STATUS_FILTERS: ReadonlyArray<Readonly<{ value: SendFilter; label: string }>> = [
  { value: "all", label: "Hepsi" },
  { value: "sending", label: SEND_STATUS_LABEL.sending },
  { value: "sent", label: SEND_STATUS_LABEL.sent },
  { value: "failed", label: SEND_STATUS_LABEL.failed },
];

function asSendStatus(raw: string | null): SendStatus | null {
  const value = raw?.trim().toLowerCase();
  return value === "failed" || value === "sending" || value === "sent" ? value : null;
}

/** The view an address asks for; a status the API would refuse means every send. */
export function readSendListView(params: URLSearchParams): SendListView {
  return { status: asSendStatus(params.get("status")) ?? "all", page: pageFromSearch(params.get("page")) };
}

export function sendListHref({ status, page = 1 }: { status: SendFilter; page?: number }): string {
  return withSearch(SEND_LIST_PATH, status, page);
}

export function fetchSendPage(api: ApiClient, view: SendListView, signal?: AbortSignal): Promise<ApiPage<Send>> {
  const range = pageRange(view.page, SEND_PAGE_SIZE);
  const query = view.status === "all" ? range : { status: view.status, ...range };
  return api.getPage<Send>("/mail_tasks", { query, signal });
}

// ---------------------------------------------------------------------------
// The send form: /mail-tasks/create?mail_list_id=<id> (ticket 16)

/** The send form, with a list to preselect: the address superadmin links an Event's list to. */
export function composeHref(listId?: string): string {
  const path = `${SEND_LIST_PATH}/create`;
  return listId ? `${path}?${new URLSearchParams({ mail_list_id: listId })}` : path;
}

// ---------------------------------------------------------------------------
// One send: /mail-tasks/show/<id>?status=failed&page=2

export type RecipientFilter = RecipientStatus | "all";
export type RecipientView = Readonly<{ status: RecipientFilter; page: number }>;

export function sendHref(id: string, view: Partial<RecipientView> = {}): string {
  return withSearch(`${SEND_LIST_PATH}/show/${id}`, view.status ?? "all", view.page ?? 1);
}

/** The recipients an address asks for: a queue status (not the send's derived one) and a page. */
export function readRecipientView(params: URLSearchParams): RecipientView {
  const status = asRecipientStatus(params.get("status")?.trim().toLowerCase());
  return { status: status ?? "all", page: pageFromSearch(params.get("page")) };
}

/** Failed first: the detail exists to follow a failure up. */
const RECIPIENT_FILTER_ORDER: readonly RecipientStatus[] = ["failed", "pending", "processing", "sent"];

/**
 * Hepsi and the statuses the send's recipients are in, each with its count,
 * plus the chosen one even if no recipient is in it (an old link).
 */
export function recipientFilters(
  counts: RecipientCounts,
  current: RecipientFilter,
): Array<{ value: RecipientFilter; label: string }> {
  const total = counts.pending + counts.processing + counts.sent + counts.failed;
  return [
    { value: "all" as const, label: `Hepsi (${formatCount(total)})` },
    ...RECIPIENT_FILTER_ORDER.filter((status) => counts[status] > 0 || status === current).map((status) => ({
      value: status,
      label: `${RECIPIENT_STATUS_LABEL[status]} (${formatCount(counts[status])})`,
    })),
  ];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A send by id. The API answers a malformed id with 500, so it is reported as the missing send it is. */
export async function fetchSend(api: ApiClient, id: string, signal?: AbortSignal): Promise<Send> {
  if (!UUID.test(id)) throw new ApiError(404, "server.not_found");
  return api.get<Send>(`/mail_tasks/${id}`, { signal });
}

/** One page of a send's recipients, newest first, filtered by queue status on the server. */
export function fetchRecipientPage(
  api: ApiClient,
  id: string,
  view: RecipientView,
  signal?: AbortSignal,
): Promise<ApiPage<RecipientRow>> {
  const range = pageRange(view.page, RECIPIENT_PAGE_SIZE);
  const query = view.status === "all" ? range : { status: view.status, ...range };
  return api.getPage<RecipientRow>(`/mail_tasks/${id}/queue`, { query, signal });
}

/** One recipient's mail as it was sent; the access says whether its parts are there. */
export function fetchSentContent(api: ApiClient, sendId: string, rowId: string, signal?: AbortSignal): Promise<SentContent> {
  if (!UUID.test(sendId)) return Promise.reject(new ApiError(404, "server.not_found"));
  return api.get<SentContent>(`/mail_tasks/${sendId}/queue/${encodeURIComponent(rowId)}/content`, { signal });
}

/** What a send's page says about its content; null for a backend that does not say. */
export function contentNote(send: Pick<Send, "content_access" | "content_expires_at">): { text: string } | null {
  switch (send.content_access) {
    case "available":
      return {
        text: send.content_expires_at
          ? `Her alıcının postasını gönderildiği hâliyle açabilirsin. İçerik ${formatClubTime(send.content_expires_at)} tarihine kadar saklanır.`
          : "Her alıcının postasını gönderildiği hâliyle açabilirsin.",
      };
    case "masked":
      return {
        text: send.content_expires_at
          ? `Her alıcının postasını açabilirsin; kodlar ve tek kullanımlık bağlantılar güvenlik için gizlendi (${MASK}). Her açılış kaydedilir. İçerik ${formatClubTime(send.content_expires_at)} tarihine kadar saklanır.`
          : `Her alıcının postasını açabilirsin; kodlar ve tek kullanımlık bağlantılar güvenlik için gizlendi (${MASK}). Her açılış kaydedilir.`,
      };
    case "sensitive":
      return {
        text: "Bu postanın içeriği gizli: giriş kodu, doğrulama kodu ya da tek kullanımlık bağlantı taşıyabilir. Yalnız kime, ne zaman gittiği ve durumu görünür.",
      };
    case "not_kept":
      return { text: NOT_KEPT_TEXT };
    case "pending":
      return { text: PENDING_TEXT };
    case "restricted":
      return {
        text: "Bu gönderimin içeriğini göremezsin. İçeriği gönderen, toplu gönderimlerde gönderme yetkisi olanlar ve SkyMail yöneticileri görür.",
      };
    case "expired":
      return {
        text: "İçerik saklama süresi dolduğu için silindi. Alıcılar ve durumları duruyor.",
      };
    default:
      return null;
  }
}

/** What the content viewer says when a recipient's mail is not there to show. */
const NOT_KEPT_TEXT =
  "Bu postanın içeriği saklanmadı: kod ya da tek kullanımlık bağlantı taşıyabilen postaların içeriği o dönemde gönderimden birkaç dakika sonra siliniyordu ya da güvenle maskelenemedi. Silinen içerik geri getirilemez; alıcılar ve durumları duruyor.";

const PENDING_TEXT =
  "İçerik maskeleniyor: kodlar ve tek kullanımlık bağlantılar gönderim bitince birkaç dakika içinde gizlenir, içerik o zaman açılır.";

export const CONTENT_MISSING_TEXT: Readonly<Record<SentContent["access"], string>> = {
  available: "",
  masked: "",
  pending: PENDING_TEXT,
  sensitive: "Bu postanın içeriği gizli.",
  not_kept: NOT_KEPT_TEXT,
  restricted: "Bu postanın içeriğini göremezsin.",
  expired: "İçerik saklama süresi dolduğu için silindi.",
  unavailable: "Bu alıcının postası saklanmıyor: hesabı silindiği için temizlendi ya da posta hiç oluşturulamadı.",
};

// ---------------------------------------------------------------------------
// A paused sender (skymail-backend ticket 28)

/**
 * What the home screen and the send list say while the sender is paused. It
 * cannot be dismissed: it goes away when SkyMail sends again.
 */
export const SENDER_PAUSED_TEXT =
  "Gönderim duraklatıldı: yeni gönderimler kuyruğa alınıyor ama hiçbiri gönderilmiyor (geri yükleme sürüyor).";

/** Whether the summary says the sender is paused: only a `true` does; a missing field does not. */
export function senderPaused(summary: SendSummary): boolean {
  return summary.sender_paused === true;
}

/** Whether the sender is paused, for a screen that shows no summary: it asks for the smallest one (a day, a send). */
export async function fetchSenderPaused(api: ApiClient, signal?: AbortSignal): Promise<boolean> {
  const summary = await api.get<SendSummary>("/mail_tasks/summary", { query: { days: 1, recent: 1 }, signal });
  return senderPaused(summary);
}

// ---------------------------------------------------------------------------
// The home screen

export type HomeTile = Readonly<{
  key: "pending" | "sentToday" | "failed";
  label: string;
  value: number;
  /** What the number counts: a mail goes to one recipient, a send to its whole audience. */
  unit: "mail" | "gönderim";
  note: string;
  href: string | null;
}>;

function zoneName(timeZone: string): string {
  return timeZone === CLUB_TIME_ZONE ? "İstanbul" : timeZone;
}

/**
 * The stat row. Each tile counts something different, so each carries its
 * unit: pending and sent-today count mails (queue rows, one per recipient),
 * failed counts sends — the same number as the failed list's total.
 */
export function homeTiles(summary: SendSummary): HomeTile[] {
  const { pending, processing } = summary.queue_counts;
  const today = summary.daily_sent.at(-1);
  return [
    {
      key: "pending",
      label: "Bekleyen mail",
      value: pending + processing,
      unit: "mail",
      note: "Kuyrukta gönderilmeyi bekleyen, alıcı başına bir mail",
      href: null,
    },
    {
      key: "sentToday",
      label: "Bugün gönderilen",
      value: today?.sent ?? 0,
      unit: "mail",
      note: `${zoneName(summary.time_zone)} saatiyle bugün alıcılara giden mail`,
      href: null,
    },
    {
      key: "failed",
      label: "Başarısız gönderim",
      value: summary.send_counts.failed,
      unit: "gönderim",
      note: "En az bir alıcısına ulaşamayan gönderim",
      href: sendListHref({ status: "failed" }),
    },
  ];
}

export type DailyPoint = Readonly<{ date: string; label: string; sent: number }>;

export function dailySeries(days: SendSummary["daily_sent"]): DailyPoint[] {
  return days.map((day) => ({ date: day.date, label: dayLabel(day.date), sent: day.sent }));
}

// A calendar day is formatted in UTC from its UTC midnight, so the process's
// zone never moves it to a neighbouring day.
const DAY_LABEL = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "short" });
const DAY_TITLE = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
});

function calendarDay(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** "23 Eyl" for the chart's axis, from the `YYYY-MM-DD` the API sent. */
export function dayLabel(date: string): string {
  const day = calendarDay(date);
  return day ? DAY_LABEL.format(day) : date;
}

/** "23 Eylül 2026 Çarşamba" for the chart's tooltip and its table. */
export function dayTitle(date: string): string {
  const day = calendarDay(date);
  return day ? DAY_TITLE.format(day) : date;
}

// ---------------------------------------------------------------------------
// Audience, Mail template, recipients, time

export type AudienceLabel = Readonly<{
  /**
   * An internal mailing list, a Keycloak group (shown as Harici), the one
   * recipient of a single send, or the people of a Mail onayı request.
   */
  kind: "list" | "group" | "person" | "people" | "form";
  name: string;
  detail: string | null;
  /** The mailing list to link to, for a list or a group. */
  listId: string | null;
  /** People beyond the ones `name` names. */
  more?: number;
  formId?: string;
  preparedAt?: string;
}>;

const UNNAMED: Readonly<Record<AudienceLabel["kind"], string>> = {
  list: "Mail listesi",
  group: "Keycloak grubu",
  person: "Tek kişi",
  people: "Kişiler",
  form: "Forms formu",
};

/** Who a send went to. A Keycloak group Keycloak could not name gets a label instead of its name. */
export function audienceLabel(audience: SendAudience): AudienceLabel {
  if (audience.kind === "form") return {
    kind: "form", name: audience.name?.trim() || UNNAMED.form, listId: null,
    detail: `${formatCount(audience.recipient_count ?? 0)} yanıtlayan`,
    formId: audience.form_id, preparedAt: audience.prepared_at,
  };
  // A request's people are its own to name (approvalAudience).
  if (audience.kind === "people") return { kind: "people", name: UNNAMED.people, detail: null, listId: null };
  if (audience.kind === "single") {
    // A send's one person is its first queue row's: none before it is queued, an emptied address once erased.
    const { recipient_full_name: name, recipient_email: email } = audience;
    const person = email === null ? recipientLabel(name, null) : mailRecipientLabel(name, email);
    return { kind: "person", name: person.name || UNNAMED.person, detail: person.address, listId: null };
  }
  const kind = audience.source === "keycloak" ? "group" : "list";
  return { kind, name: audience.name?.trim() || UNNAMED[kind], detail: null, listId: audience.mail_list_id };
}

export function templateLabel(send: { template_name: string | null }): string {
  return send.template_name?.trim() || "Mail template yok";
}

const COUNT = new Intl.NumberFormat("tr-TR");

/** 1532 → "1.532". */
export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** "Alıcı yok", "1 alıcı", "1.532 alıcı". */
export function recipientsLabel(total: number): string {
  return total === 0 ? "Alıcı yok" : `${formatCount(total)} alıcı`;
}

/** A send's recipients in total, and the statuses among them that occur. */
export function recipientSummary(counts: RecipientCounts): { total: number; parts: string[] } {
  const waiting = counts.pending + counts.processing;
  const cancelled = counts.cancelled ?? 0;
  const failed = counts.failed - cancelled;
  const parts: string[] = [];
  if (counts.sent) parts.push(`${formatCount(counts.sent)} gönderildi`);
  if (failed) parts.push(`${formatCount(failed)} başarısız`);
  if (waiting) parts.push(`${formatCount(waiting)} bekliyor`);
  if (cancelled) parts.push(`${formatCount(cancelled)} iptal edildi`);
  return { total: waiting + counts.sent + counts.failed, parts };
}

/** "2 ulaşmadı", "3 bastırıldı", "1 hesap postası bastırılmış adrese gitti": only what happened. */
export function deliveryNotes(counts: SendRecipientCounts): string[] {
  const notes: string[] = [];
  if (counts.undelivered) notes.push(`${formatCount(counts.undelivered)} ulaşmadı`);
  if (counts.suppressed) notes.push(`${formatCount(counts.suppressed)} bastırıldı`);
  if (counts.suppressed_but_sent) notes.push(`${formatCount(counts.suppressed_but_sent)} hesap postası bastırılmış adrese gitti`);
  return notes;
}

const QUEUE_GRACE_MS = 60_000;

/**
 * What a send with no queue rows means. The mailer writes the send, then its
 * rows; the API calls such a send sending for its first minute and failed
 * after — its template would not render, or its audience had no one in it.
 */
export function noRecipientsNote(createdAt: string, now: Date = new Date()): string {
  const age = now.getTime() - new Date(createdAt).getTime();
  return age < QUEUE_GRACE_MS
    ? "Alıcılar kuyruğa yazılıyor. Birkaç saniye sonra sayfayı yenile."
    : "Bu gönderimde kimse kuyruğa alınmadı: Mail template işlenemedi ya da kitlede kimse yoktu. Kimseye mail gitmedi; gönderim başarısız sayılır.";
}

/** A send's time, as every screen shows it (src/lib/format.ts). */
export const formatSendTime = formatClubTime;
