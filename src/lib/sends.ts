/**
 * Sends — mail tasks — as the home screen and the send list show them: the
 * shapes skymail-backend answers with, and what the panel makes of them.
 *
 * A send has no status of its own. The API derives one from its recipients'
 * queue rows (`mail_task_status`, skymail-backend PR #21): `failed` when any
 * recipient failed (or none was queued a minute after the send), `sending`
 * while any is pending or processing, `sent` otherwise. The summary and the
 * `?status=` filter use that one definition, so the failed tile on the home
 * screen always equals the failed list's total.
 */

export const SEND_TIME_ZONE = "Europe/Istanbul";

export type SendStatus = "failed" | "sending" | "sent";
export type RecipientStatus = "pending" | "processing" | "sent" | "failed";

/** Queue rows by status; each row is one mail to one recipient. */
export type RecipientCounts = Readonly<Record<RecipientStatus, number>>;

/** Who a recent send went to (`recent_sends[].audience`). Fields that do not apply to the kind are null. */
export type SendAudience = Readonly<{
  kind: "mailing_list" | "single";
  mail_list_id: string | null;
  name: string | null;
  source: "internal" | "keycloak" | null;
  recipient_full_name: string | null;
  recipient_email: string | null;
}>;

export type RecentSend = Readonly<{
  id: string;
  created_at: string;
  sent_by: string;
  template_id: string | null;
  template_name: string | null;
  template_key: string | null;
  audience: SendAudience;
  status: SendStatus;
  recipient_counts: RecipientCounts;
}>;

/** `GET /mail_tasks/summary`. */
export type SendSummary = Readonly<{
  time_zone: string;
  queue_counts: RecipientCounts;
  send_counts: Readonly<Record<SendStatus, number>>;
  /** Oldest first, ending today; `date` is an Istanbul calendar day (`YYYY-MM-DD`). */
  daily_sent: ReadonlyArray<Readonly<{ date: string; sent: number }>>;
  recent_sends: readonly RecentSend[];
}>;

/** `GET /mail_tasks/:id`. */
export type SendRecord = Readonly<{
  id: string;
  sent_by: string;
  template_id: string | null;
  mail_list_id: string | null;
  created_at: string;
  template_name: string | null;
  /** Null for a Keycloak group, and for a single send. */
  mail_list_name: string | null;
}>;

/** A row of `GET /mail_tasks`. */
export type SendRow = SendRecord &
  Readonly<{
    status: SendStatus;
    recipient_counts: RecipientCounts;
  }>;

/** sqlc's NullMailQueueStatus, as skymail-backend encodes a queue row's status. */
type QueueStatus = Readonly<{ mail_queue_status: string; valid: boolean }>;

/** A row of `GET /mail_tasks/:id/queue`: one recipient of the send. */
export type RecipientRow = Readonly<{
  id: string;
  recipient_full_name: string;
  recipient_email: string;
  status: QueueStatus | string | null;
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

const RECIPIENT_STATUSES: readonly string[] = ["pending", "processing", "sent", "failed"];

/** A queue row's status; a row without one is pending, as the queue's default is. */
export function recipientStatus(raw: RecipientRow["status"]): RecipientStatus {
  const value = typeof raw === "string" ? raw : raw?.valid ? raw.mail_queue_status : null;
  return value !== null && RECIPIENT_STATUSES.includes(value) ? (value as RecipientStatus) : "pending";
}

// ---------------------------------------------------------------------------
// The send list's address: ?status= and ?page=

export const SEND_LIST_PATH = "/mail-tasks";

export const STATUS_FILTERS: ReadonlyArray<Readonly<{ value: SendStatus | null; label: string }>> = [
  { value: null, label: "Hepsi" },
  { value: "sending", label: SEND_STATUS_LABEL.sending },
  { value: "sent", label: SEND_STATUS_LABEL.sent },
  { value: "failed", label: SEND_STATUS_LABEL.failed },
];

/** The status in `?status=`; anything the API would refuse means every send. */
export function statusFromSearch(raw: string | null | undefined): SendStatus | null {
  const value = raw?.trim().toLowerCase();
  return value === "failed" || value === "sending" || value === "sent" ? value : null;
}

/** The page in `?page=`, counted from 1. */
export function pageFromSearch(raw: string | null | undefined): number {
  const value = raw?.trim() ?? "";
  if (!/^\d+$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** A page's `_start`/`_end`. */
export function pageRange(page: number, pageSize: number): { _start: number; _end: number } {
  return { _start: (page - 1) * pageSize, _end: page * pageSize };
}

export function sendListHref({ status, page = 1 }: { status: SendStatus | null; page?: number }): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${SEND_LIST_PATH}?${search}` : SEND_LIST_PATH;
}

/** The query for `GET /mail_tasks`. */
export function sendListQuery({
  status,
  page,
  pageSize,
}: {
  status: SendStatus | null;
  page: number;
  pageSize: number;
}): { status?: SendStatus; _start: number; _end: number } {
  return status ? { status, ...pageRange(page, pageSize) } : pageRange(page, pageSize);
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
      note: "İstanbul saatiyle bugün alıcılara giden mail",
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

const DAY_LABEL = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "short" });
const DAY_TITLE = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
});

/** A `YYYY-MM-DD` day read as the calendar day it names, never shifted through a time zone. */
function calendarDay(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** "23 Eyl" for the chart's axis. */
export function dayLabel(date: string): string {
  const day = calendarDay(date);
  return day ? DAY_LABEL.format(day) : date;
}

/** "23 Eylül 2026 Çarşamba" for the chart's tooltip. */
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

export const AUDIENCE_KIND_LABEL: Readonly<Record<AudienceLabel["kind"], string>> = {
  list: "Mail listesi",
  group: "Keycloak grubu",
  person: "Tek kişi",
};

/** A recent send's audience. A Keycloak group Keycloak could not name gets a label instead. */
export function audienceOfRecentSend(audience: SendAudience): AudienceLabel {
  if (audience.kind === "single") {
    const name = audience.recipient_full_name?.trim() || null;
    const email = audience.recipient_email?.trim() || null;
    return {
      kind: "person",
      name: name ?? email ?? AUDIENCE_KIND_LABEL.person,
      detail: name ? email : null,
      listId: null,
    };
  }
  const kind = audience.source === "keycloak" ? "group" : "list";
  return {
    kind,
    name: audience.name?.trim() || AUDIENCE_KIND_LABEL[kind],
    detail: null,
    listId: audience.mail_list_id,
  };
}

/**
 * A send list row's or a send's audience. These carry no Keycloak group
 * names, so a list without a name is a Keycloak group — the same test the
 * summary makes — and no list at all is a single send.
 */
export function audienceOfSendRow(row: Pick<SendRecord, "mail_list_id" | "mail_list_name">): AudienceLabel {
  if (!row.mail_list_id) {
    return { kind: "person", name: AUDIENCE_KIND_LABEL.person, detail: null, listId: null };
  }
  const name = row.mail_list_name?.trim() || null;
  return name
    ? { kind: "list", name, detail: null, listId: row.mail_list_id }
    : { kind: "group", name: AUDIENCE_KIND_LABEL.group, detail: null, listId: row.mail_list_id };
}

export function templateLabel(send: { template_name: string | null }): string {
  return send.template_name?.trim() || "Mail template yok";
}

/** A send's recipients in total, and the statuses among them that occur. */
export function recipientSummary(counts: RecipientCounts): { total: number; parts: string[] } {
  const waiting = counts.pending + counts.processing;
  const parts: string[] = [];
  if (counts.sent) parts.push(`${counts.sent} gönderildi`);
  if (counts.failed) parts.push(`${counts.failed} başarısız`);
  if (waiting) parts.push(`${waiting} bekliyor`);
  return { total: waiting + counts.sent + counts.failed, parts };
}

/** A page of queue rows counted by status. */
export function countRecipients(rows: readonly RecipientRow[]): RecipientCounts {
  const counts = { pending: 0, processing: 0, sent: 0, failed: 0 };
  for (const row of rows) counts[recipientStatus(row.status)] += 1;
  return counts;
}

const FOLLOW_UP_RANK: Readonly<Record<RecipientStatus, number>> = {
  failed: 0,
  processing: 1,
  pending: 2,
  sent: 3,
};

/**
 * A page of recipients in the order a follow-up needs: failed first, then
 * those still going out, then sent; the API's order (newest first) within
 * each. The API cannot filter a send's queue by status, so this orders what
 * one page holds.
 */
export function followUpOrder(rows: readonly RecipientRow[]): RecipientRow[] {
  return rows
    .map((row, index) => ({ row, index, rank: FOLLOW_UP_RANK[recipientStatus(row.status)] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ row }) => row);
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

const SEND_TIME = new Intl.DateTimeFormat("tr-TR", {
  timeZone: SEND_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "23 Eyl 2026 09:00", in Istanbul whatever the browser's zone. */
export function formatSendTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? "—" : SEND_TIME.format(time);
}

const COUNT = new Intl.NumberFormat("tr-TR");

/** 1532 → "1.532". */
export function formatCount(value: number): string {
  return COUNT.format(value);
}
