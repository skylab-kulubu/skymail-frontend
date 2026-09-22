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
import { pageCount, pageRange } from "./list-view";

/** The club's zone, and the summary's: send times are shown in it. */
const CLUB_TIME_ZONE = "Europe/Istanbul";

export const SEND_PAGE_SIZE = 25;
export const RECIPIENT_PAGE_SIZE = 25;

export type SendStatus = "failed" | "sending" | "sent";
export type RecipientStatus = "pending" | "processing" | "sent" | "failed";

/** Queue rows by status; each row is one mail to one recipient. */
export type RecipientCounts = Readonly<Record<RecipientStatus, number>>;

/** Who a send went to. Fields that do not apply to the kind are null. */
export type SendAudience = Readonly<{
  kind: "mailing_list" | "single";
  mail_list_id: string | null;
  /** A list's name; a Keycloak group's as Keycloak gave it, or null when it could not. */
  name: string | null;
  source: "internal" | "keycloak" | null;
  recipient_full_name: string | null;
  recipient_email: string | null;
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
  recipient_counts: RecipientCounts;
}>;

/** `GET /mail_tasks/summary`. */
export type SendSummary = Readonly<{
  /** The zone `daily_sent`'s days are in. */
  time_zone: string;
  queue_counts: RecipientCounts;
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

/**
 * How many pages to offer. Without the API's total (X-Total-Count did not
 * reach the browser) a full page may have another after it.
 */
export function knownPageCount(
  loaded: { total: number | null; rows: number },
  page: number,
  pageSize: number,
): number {
  if (loaded.total !== null) return pageCount(loaded.total, pageSize);
  return loaded.rows >= pageSize ? page + 1 : page;
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
  /** An internal mailing list, a Keycloak group (shown as Harici), or the one recipient of a single send. */
  kind: "list" | "group" | "person";
  name: string;
  detail: string | null;
  /** The mailing list to link to, for a list or a group. */
  listId: string | null;
}>;

const UNNAMED: Readonly<Record<AudienceLabel["kind"], string>> = {
  list: "Mail listesi",
  group: "Keycloak grubu",
  person: "Tek kişi",
};

/** Who a send went to. A Keycloak group Keycloak could not name gets a label instead of its name. */
export function audienceLabel(audience: SendAudience): AudienceLabel {
  if (audience.kind === "single") {
    const name = audience.recipient_full_name?.trim() || null;
    const email = audience.recipient_email?.trim() || null;
    return { kind: "person", name: name ?? email ?? UNNAMED.person, detail: name ? email : null, listId: null };
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
  const parts: string[] = [];
  if (counts.sent) parts.push(`${formatCount(counts.sent)} gönderildi`);
  if (counts.failed) parts.push(`${formatCount(counts.failed)} başarısız`);
  if (waiting) parts.push(`${formatCount(waiting)} bekliyor`);
  return { total: waiting + counts.sent + counts.failed, parts };
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

const SEND_TIME = new Map<string, Intl.DateTimeFormat>();

function sendTimeFormat(timeZone: string): Intl.DateTimeFormat {
  let format = SEND_TIME.get(timeZone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat("tr-TR", {
        timeZone,
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      // A zone this browser does not know: the club's.
      return sendTimeFormat(CLUB_TIME_ZONE);
    }
    SEND_TIME.set(timeZone, format);
  }
  return format;
}

/**
 * "23 Eyl 2026 09:00" in `timeZone` — the summary's `time_zone` on the home
 * screen, the club's (Europe/Istanbul) elsewhere — whatever the browser's.
 */
export function formatSendTime(iso: string | null | undefined, timeZone: string = CLUB_TIME_ZONE): string {
  if (!iso) return "—";
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? "—" : sendTimeFormat(timeZone).format(time);
}
