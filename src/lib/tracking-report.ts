/**
 * A tracked send's opens and clicks (hub ticket iletisim-servisi 15b, design
 * note 07 §3.2 and §4.9), as skymail-backend's read routes give them
 * (internal/handlers/tracking_read.go):
 *
 *  - `GET /mail_tasks/{id}/tracking` (mails:read): counts, per-link counts and
 *    an hourly-then-daily series, with no person and no link address in it. A
 *    year after the last mail went out it is `retained`: only the totals kept
 *    for a send to at least ten tracked recipients, or none (`report: null`).
 *  - `GET /mail_tasks/{id}/tracking/recipients` (`skymail:mails:tracking:read`,
 *    or the send's own sender): one row per recipient, filtered and paged;
 *    410 a year after the last mail went out.
 *
 * An open is never proof the mail was read: Apple Mail loads images by itself
 * and Outlook blocks them. The screen speaks of opens seen or not seen, never
 * of reading.
 */
import type { ApiClient } from "./api/client";
import { ApiError } from "./api/errors";
import { CLUB_TIME_ZONE } from "./format";
import { hasRole, ROLE } from "./access";
import type { Send } from "./sends";

export const TRACKING_PAGE_SIZE = 25;

/** Said once at the top of the section (design note 07 §3.2). */
export const TRACKING_CAVEAT =
  "Açılma kesin değildir. Apple Mail postayı kendisi yükleyebilir, Outlook resimleri engelleyebilir. Tıklama daha güçlü bir işarettir.";

/** What the recipients route answers (410) and the retained summary means. */
export const TRACKING_EXPIRED_TEXT = "Kişi bazında kayıt 1 yıl sonra silindi.";

export type TrackingLinkCounts = Readonly<{ id: number; position: number; clicks: number; unique_clickers: number }>;

export type TrackingPoint = Readonly<{
  at: string;
  interval: "hour" | "day";
  likely_human_opens: number;
  automated_opens: number;
  likely_human_clicks: number;
  automated_clicks: number;
}>;

export type TrackingAggregate = Readonly<{
  tracked_recipients: number;
  /** Untracked recipients by reason (`no_account`, `preference_off`, …). */
  untracked_by_reason: Readonly<Record<string, number>>;
  unique_opens: number;
  /** Recipients with an open or a click not marked automatic (a click infers an open). */
  unique_likely_human_opens: number;
  /** Recipients whose every event looked automatic; absent from retained totals. */
  automated_only_recipients?: number;
  unique_clickers: number;
  clicks_by_link: readonly TrackingLinkCounts[];
  /** Absent from retained totals; empty buckets are not written. */
  series?: readonly TrackingPoint[];
  rolled_up_at?: string;
}>;

export type TrackingSummary = Readonly<{
  tracking_available: boolean;
  tracking_requested: boolean;
  retained: boolean;
  report: TrackingAggregate | null;
}>;

export type TrackingRecipientLink = Readonly<{ link_id: number; clicks: number; last_clicked_at: string }>;

export type TrackingRecipient = Readonly<{
  id: string;
  recipient_sub: string | null;
  recipient_email: string;
  recipient_full_name: string;
  tracked: boolean;
  tracking_skip_reason: string | null;
  first_open_at: string | null;
  first_likely_human_open_at: string | null;
  likely_human_open_source: "open" | "click_inferred" | null;
  open_count: number;
  last_clicked_at: string | null;
  automated_only: boolean;
  source_classes: readonly string[];
  clicked_links: readonly TrackingRecipientLink[];
}>;

export type TrackingRecipientPage = Readonly<{
  tracking_available: boolean;
  page: number;
  page_size: number;
  total: number;
  items: readonly TrackingRecipient[];
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fetchTrackingSummary(api: ApiClient, sendId: string, signal?: AbortSignal): Promise<TrackingSummary> {
  if (!UUID.test(sendId)) return Promise.reject(new ApiError(404, "server.not_found"));
  return api.get<TrackingSummary>(`/mail_tasks/${sendId}/tracking`, { signal });
}

export type TrackingFilter = "all" | "opened" | "not_opened" | "clicked" | "automated_only";

export const TRACKING_FILTERS: ReadonlyArray<Readonly<{ value: TrackingFilter; label: string }>> = [
  { value: "all", label: "Hepsi" },
  { value: "opened", label: "Açılma görüldü" },
  { value: "not_opened", label: "Açılma görülmedi" },
  { value: "clicked", label: "Tıkladı" },
  { value: "automated_only", label: "Yalnız otomatik" },
];

export function fetchTrackingRecipients(
  api: ApiClient,
  sendId: string,
  view: Readonly<{ filter: TrackingFilter; page: number }>,
  signal?: AbortSignal,
): Promise<TrackingRecipientPage> {
  if (!UUID.test(sendId)) return Promise.reject(new ApiError(404, "server.not_found"));
  const query: Record<string, string | number> = { page: view.page, page_size: TRACKING_PAGE_SIZE };
  if (view.filter !== "all") query.filter = view.filter;
  return api.get<TrackingRecipientPage>(`/mail_tasks/${sendId}/tracking/recipients`, { query, signal });
}

/** Whether the send's page shows the section at all: only a send that asked for tracking and got it. */
export function sendTracked(send: Pick<Send, "tracking">): boolean {
  return send.tracking === true;
}

/**
 * Whether the viewer may see the send's recipients one by one, as the API
 * decides it: `skymail:mails:tracking:read` (YK, DK, ADMIN), or the send's own
 * sender without any further role. Anyone else gets the counts only, and the
 * page never asks for the people.
 */
export function mayReadTrackingRecipients(
  roles: readonly string[],
  viewerSub: string | null | undefined,
  send: Pick<Send, "sent_by">,
): boolean {
  if (hasRole(roles, ROLE.mailsTrackingRead)) return true;
  return Boolean(viewerSub) && viewerSub === send.sent_by;
}

// ---------------------------------------------------------------------------
// Wording

const SKIP_REASON: Readonly<Record<string, string>> = {
  no_account: "Hesabı yok",
  not_member: "Üye değil",
  preference_off: "Takibi kapatmış",
  inactive: "Hesabı etkin değil",
  preference_unavailable: "Tercihi öğrenilemedi",
  flag_off: "Takip kapalıydı",
  not_allowed: "İzin yok",
  not_requested: "Takip istenmedi",
  not_delivered: "Posta gitmedi",
  tracking_closed: "Takip sonradan kapandı",
};

/** Why a recipient was not tracked, in plain words. */
export function skipReasonLabel(reason: string | null | undefined): string {
  return (reason && SKIP_REASON[reason]) || "Diğer";
}

/** The untracked recipients by reason, largest first, each reason once. */
export function untrackedParts(byReason: Readonly<Record<string, number>>): { total: number; parts: string[] } {
  const merged = new Map<string, number>();
  for (const [reason, count] of Object.entries(byReason)) {
    if (!(count > 0)) continue;
    const label = skipReasonLabel(reason);
    merged.set(label, (merged.get(label) ?? 0) + count);
  }
  const entries = [...merged.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
  return {
    total: entries.reduce((sum, [, count]) => sum + count, 0),
    parts: entries.map(([label, count]) => `${label}: ${COUNT.format(count)}`),
  };
}

const COUNT = new Intl.NumberFormat("tr-TR");

/** "%40" of the tracked recipients; null when nobody was tracked. */
export function shareOf(part: number, whole: number): string | null {
  if (!(whole > 0)) return null;
  return `%${Math.round((part / whole) * 100)}`;
}

/** A link by its place in the mail: the API gives no address (a one-person send's link may name the person). */
export function linkLabel(position: number): string {
  return `${position + 1}. bağlantı`;
}

export type TrackingBadge = Readonly<{ key: string; label: string; tone: "warning" | "info" | "neutral" }>;

const SOURCE_BADGE: Readonly<Record<string, TrackingBadge>> = {
  apple_proxy_likely: { key: "apple", label: "Muhtemelen otomatik (Apple Mail)", tone: "warning" },
  google_proxy: { key: "google", label: "Gmail üzerinden: tekrar açılmalar görünmez", tone: "info" },
  scanner_likely: { key: "scanner", label: "Güvenlik taraması olası", tone: "warning" },
};

/** The marks a recipient's row carries (design note 07 §3.2), in a fixed order. */
export function recipientBadges(row: Pick<TrackingRecipient, "source_classes" | "likely_human_open_source">): TrackingBadge[] {
  const badges: TrackingBadge[] = [];
  for (const source of ["apple_proxy_likely", "google_proxy", "scanner_likely"]) {
    if (row.source_classes.includes(source)) badges.push(SOURCE_BADGE[source]);
  }
  if (row.likely_human_open_source === "click_inferred") {
    badges.push({ key: "click", label: "Tıklamadan çıkarım", tone: "neutral" });
  }
  return badges;
}

/** What the first likely real open cell says when it has no time. */
export function noLikelyOpenText(row: Pick<TrackingRecipient, "tracked" | "automated_only" | "first_open_at">): string {
  if (!row.tracked) return "Takip edilmedi";
  if (row.automated_only && row.first_open_at) return "Yalnız otomatik açılma";
  return "Açılma görülmedi";
}

/** Which links a recipient clicked, by their place in the mail; ids the summary does not know read as "bağlantı". */
export function clickedLinksText(
  clicked: readonly TrackingRecipientLink[],
  links: readonly TrackingLinkCounts[],
): string {
  if (clicked.length === 0) return "—";
  const positions = new Map(links.map((link) => [link.id, link.position]));
  return clicked
    .map((link) => {
      const position = positions.get(link.link_id);
      const name = position === undefined ? "bağlantı" : linkLabel(position);
      return link.clicks > 1 ? `${name} (${COUNT.format(link.clicks)})` : name;
    })
    .join(", ");
}

// ---------------------------------------------------------------------------
// The series: the first 72 hours by the hour, then by the day (UTC buckets)

export type TrackingSeriesRow = Readonly<{
  at: string;
  interval: "hour" | "day";
  /** The axis and the table's first column: "20 Eki 14:00" or "23 Eki". */
  label: string;
  likely_human_opens: number;
  automated_opens: number;
  clicks: number;
}>;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const HOUR_LABEL = new Intl.DateTimeFormat("tr-TR", {
  timeZone: CLUB_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
// A day bucket is a UTC day; formatting it in UTC keeps its date.
const DAY_LABEL = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "short" });

function rowOf(at: number, interval: "hour" | "day", point?: TrackingPoint): TrackingSeriesRow {
  return {
    at: new Date(at).toISOString(),
    interval,
    label: (interval === "hour" ? HOUR_LABEL : DAY_LABEL).format(new Date(at)),
    likely_human_opens: point?.likely_human_opens ?? 0,
    automated_opens: point?.automated_opens ?? 0,
    clicks: (point?.likely_human_clicks ?? 0) + (point?.automated_clicks ?? 0),
  };
}

/**
 * The chart's rows. The API writes no empty bucket, so the hours between the
 * first and the last hourly point, and the days between the first and the last
 * daily one, are filled with zeros: the axis keeps time even where nothing
 * happened. Only counts; no person is in it.
 */
export function trackingSeries(points: readonly TrackingPoint[] | undefined): TrackingSeriesRow[] {
  if (!points || points.length === 0) return [];
  const rows: TrackingSeriesRow[] = [];
  for (const interval of ["hour", "day"] as const) {
    const step = interval === "hour" ? HOUR_MS : DAY_MS;
    const byTime = new Map<number, TrackingPoint>();
    for (const point of points) {
      const at = Date.parse(point.at);
      if (point.interval === interval && !Number.isNaN(at)) byTime.set(at, point);
    }
    if (byTime.size === 0) continue;
    const times = [...byTime.keys()].sort((a, b) => a - b);
    const first = times[0];
    const last = times[times.length - 1];
    // A gap that is not a whole number of steps (it never is from the API) is left as the points are.
    if ((last - first) % step !== 0) {
      for (const at of times) rows.push(rowOf(at, interval, byTime.get(at)));
      continue;
    }
    for (let at = first; at <= last; at += step) rows.push(rowOf(at, interval, byTime.get(at)));
  }
  return rows;
}

/** Whether the series has anything to draw. */
export function seriesHasEvents(rows: readonly TrackingSeriesRow[]): boolean {
  return rows.some((row) => row.likely_human_opens + row.automated_opens + row.clicks > 0);
}

export const SERIES_LABELS = {
  likely_human_opens: "Açılma (insan olası)",
  automated_opens: "Açılma (muhtemelen otomatik)",
  clicks: "Tıklama",
} as const;
