/**
 * Mail onayı (ADR-0031, ticket 18) as skymail-backend serves it (ticket 19,
 * `internal/handlers/mail_approval*.go`, routes under `/mail_approvals`) and
 * as the screens show it (ticket 20): a send someone submitted instead of
 * sending, held until an approver (`skymail:mails:approve`) decides it.
 *
 *  - A request is `pending` until an approver approves it (it is sent),
 *    rejects it with a reason, or edits its variables and either sends the
 *    edit or returns it to the submitter (`returned`), who accepts it (it is
 *    sent) or declines it (`declined`). A rejected or declined request can be
 *    resubmitted.
 *  - Undecided seven days after it was submitted — or returned — it expires
 *    and is never sent. Reads already show an overdue request as `expired`;
 *    the sweep records it within a minute.
 *  - An approver lists everyone's requests; anyone else only their own.
 *
 * The approval mails link here: `/mail-approvals/show/:id`, `#preview` for the
 * preview.
 */
import type { ApiClient, ApiPage } from "../api/client";
import { formatClubTime } from "../format";
import { pageRange, readPage, viewHref } from "../list-view";
import { SEND_LIST_PATH, type SendAudience } from "../sends";

export const APPROVAL_PAGE_SIZE = 25;

export type ApprovalState = "pending" | "returned" | "approved" | "rejected" | "declined" | "expired";

export type ApprovalEventKind =
  | "submitted"
  | "resubmitted"
  | "edited"
  | "returned"
  | "accepted"
  | "declined"
  | "approved"
  | "rejected"
  | "expired";

/** Someone as their token named them when they acted. */
export type ApprovalPerson = Readonly<{ sub: string; name: string | null }>;

/** Who submitted a request, and the address the decision is mailed to. */
export type ApprovalSubmitter = Readonly<{ sub: string; name: string | null; email: string | null }>;

/** The template a request sends, pinned to the version published when it was last submitted. */
export type ApprovalTemplate = Readonly<{
  id: string;
  version_id: string;
  name: string;
  key: string | null;
  /** Another version was published since: approving or accepting is refused until the submitter resubmits. */
  republished: boolean;
}>;

/** One thing an edit or a resubmission changed. */
export type ApprovalChange = Readonly<{
  field: "variable" | "template" | "audience";
  /** The variable's name; null for the template and the audience. */
  name: string | null;
  /** Null when there was none. */
  before: unknown;
  /** Null when there is none. */
  after: unknown;
}>;

export type ApprovalEvent = Readonly<{
  seq: number;
  kind: ApprovalEventKind;
  /** Null when SkyMail expired the request. */
  actor: ApprovalPerson | null;
  /** A rejection's reason, or a note the approver or the submitter left. */
  note: string | null;
  changes: readonly ApprovalChange[] | null;
  /** The send an approval or an acceptance queued. */
  task_id: string | null;
  at: string;
}>;

/** A request as the list shows it (`handlers.MailApprovalItem`). */
export type ApprovalItem = Readonly<{
  id: string;
  state: ApprovalState;
  submitter: ApprovalSubmitter;
  template: ApprovalTemplate;
  audience: SendAudience;
  /** As submitted, or as an approver edited them. */
  body_variables: Readonly<Record<string, unknown>> | null;
  created_at: string;
  /** When it was last submitted. */
  submitted_at: string;
  /** Pending or returned past this, it expires. */
  deadline_at: string;
  updated_at: string;
  task_id: string | null;
  last_event: ApprovalEvent | null;
}>;

/** The mail an action sent about itself. */
export type ApprovalNotification = Readonly<{
  template_key: string;
  notified: number;
  /** Why it reached no one or fewer than it was for; null when it reached everyone. */
  problem: string | null;
}>;

export type ApprovalPreview = Readonly<{
  subject: string;
  /** Operators' template markup with the values: shown only in a sandboxed frame. */
  html: string;
  plain_text: string;
  /** The single recipient, or for a list the submitter, as if they were on it. */
  rendered_for: Readonly<{ full_name: string; email: string }>;
}>;

/** A request whole (`handlers.MailApproval`). */
export type MailApproval = ApprovalItem &
  Readonly<{
    /** How many it would reach now; null when Keycloak did not say in time. */
    recipient_count: number | null;
    preview: ApprovalPreview | null;
    preview_error: string | null;
    history: readonly ApprovalEvent[] | null;
    /** On the answer to an action. */
    notification?: ApprovalNotification;
  }>;

// ---------------------------------------------------------------------------
// Addresses

export const APPROVAL_LIST_PATH = "/mail-approvals";

/** A request: where the approval mails link. */
export const approvalHref = (id: string) => `${APPROVAL_LIST_PATH}/show/${encodeURIComponent(id)}`;

/** A request's preview (`PreviewUrl` in the approval mail). */
export const approvalPreviewHref = (id: string) => `${approvalHref(id)}#preview`;

/** The send form, filled from a rejected or declined request, resubmitting it. */
export const resubmitHref = (id: string) => `${APPROVAL_LIST_PATH}/edit/${encodeURIComponent(id)}`;

/** The send form, filled from a request, starting a new one: after an expiry. */
export const copyApprovalHref = (id: string) => `${SEND_LIST_PATH}/create?${new URLSearchParams({ from_approval: id })}`;

// ---------------------------------------------------------------------------
// The list: /mail-approvals?state=returned&mine=true&page=2

export type ApprovalFilter = ApprovalState | "all";
/** `mine`: only the viewer's own requests — an approver's choice; anyone else sees only theirs anyway. */
export type ApprovalListView = Readonly<{ state: ApprovalFilter; mine: boolean; page: number }>;
type Viewer = Readonly<{ approver: boolean }>;

export const APPROVAL_FILTERS: ReadonlyArray<Readonly<{ value: ApprovalFilter; label: string }>> = [
  { value: "pending", label: "Bekleyen" },
  { value: "returned", label: "Geri dönen" },
  { value: "approved", label: "Onaylanan" },
  { value: "rejected", label: "Reddedilen" },
  { value: "declined", label: "Kabul edilmedi" },
  { value: "expired", label: "Süresi dolan" },
  { value: "all", label: "Hepsi" },
];

/** Whose requests an approver sees: everyone's, or only the ones they submitted (`?mine=true`). */
export const APPROVAL_SCOPES: ReadonlyArray<Readonly<{ value: "all" | "mine"; label: string }>> = [
  { value: "all", label: "Herkesin" },
  { value: "mine", label: "Benim sunduklarım" },
];

const STATES: readonly ApprovalState[] = ["pending", "returned", "approved", "rejected", "declined", "expired"];

/** What an approver sees first is what waits for them; anyone else, all of their own. */
const defaultFilter = ({ approver }: Viewer): ApprovalFilter => (approver ? "pending" : "all");

export function readApprovalListView(params: URLSearchParams, viewer: Viewer): ApprovalListView {
  const raw = params.get("state");
  const state = raw === "all" || STATES.includes(raw as ApprovalState) ? (raw as ApprovalFilter) : defaultFilter(viewer);
  return { state, mine: !viewer.approver || params.get("mine") === "true", page: readPage(params) };
}

export function approvalListHref(view: ApprovalListView, viewer: Viewer): string {
  return viewHref(APPROVAL_LIST_PATH, {
    state: [view.state, defaultFilter(viewer)],
    mine: [String(viewer.approver && view.mine), "false"],
    page: [view.page, 1],
  });
}

/** One page of the list: everyone's or an approver's own, the viewer's own for anyone else. */
export function fetchApprovalPage(
  api: ApiClient,
  view: ApprovalListView,
  { approver }: Viewer,
  signal?: AbortSignal,
): Promise<ApiPage<ApprovalItem>> {
  return api.getPage<ApprovalItem>("/mail_approvals", {
    query: {
      state: view.state === "all" ? undefined : view.state,
      mine: !approver || view.mine ? true : undefined,
      ...pageRange(view.page, APPROVAL_PAGE_SIZE),
    },
    signal,
  });
}

/** How many requests wait for an approver: the pending list's total, null when the answer does not say. */
export async function pendingCount(api: ApiClient, signal?: AbortSignal): Promise<number | null> {
  const page = await api.getPage<ApprovalItem>("/mail_approvals", { query: { state: "pending", ...pageRange(1, 1) }, signal });
  return page.total;
}

export function fetchApproval(api: ApiClient, id: string, signal?: AbortSignal): Promise<MailApproval> {
  return api.get<MailApproval>(`/mail_approvals/${encodeURIComponent(id)}`, { signal });
}

// ---------------------------------------------------------------------------
// Time

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type DeadlineHint = Readonly<{ text: string; urgent: boolean; passed: boolean }>;

/** How long is left until `deadline`: whole days, then hours on the last day; null for a time that is not one. */
export function deadlineHint(deadline: string, now: Date = new Date()): DeadlineHint | null {
  const at = new Date(deadline).getTime();
  if (!deadline || Number.isNaN(at)) return null;
  const left = at - now.getTime();
  if (left <= 0) return { text: "Süresi doldu", urgent: false, passed: true };
  if (left >= DAY) return { text: `${Math.floor(left / DAY)} gün kaldı`, urgent: false, passed: false };
  if (left >= HOUR) return { text: `${Math.floor(left / HOUR)} saat kaldı`, urgent: true, passed: false };
  return { text: "1 saatten az kaldı", urgent: true, passed: false };
}

/** Where the deadline still runs: a request waiting for someone. */
export const isWaiting = (state: ApprovalState) => state === "pending" || state === "returned";

/**
 * The state as it stands now. The API reads a request past its deadline as
 * expired; a page left open past it does the same, rather than offer an
 * action the API would refuse.
 */
export function effectiveState(request: Pick<ApprovalItem, "state" | "deadline_at">, now: Date = new Date()): ApprovalState {
  return isWaiting(request.state) && deadlineHint(request.deadline_at, now)?.passed ? "expired" : request.state;
}

/** A request's times, as every screen shows them: the club's zone. */
export const formatApprovalTime = formatClubTime;

// ---------------------------------------------------------------------------
// Words

export const APPROVAL_STATE_LABEL: Readonly<Record<ApprovalState, string>> = {
  pending: "Onay bekliyor",
  returned: "Sunana döndü",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  declined: "Düzenleme kabul edilmedi",
  expired: "Süresi doldu",
};

const UNKNOWN_PERSON = "Adı bilinmeyen üye";

export function submitterName(submitter: ApprovalSubmitter): string {
  return submitter.name?.trim() || submitter.email?.trim() || UNKNOWN_PERSON;
}

const EVENT_LABEL: Readonly<Record<ApprovalEventKind, string>> = {
  submitted: "Onaya sundu",
  resubmitted: "Yeniden onaya sundu",
  edited: "Değişkenleri düzenledi",
  returned: "Düzenlemeyi sunana geri gönderdi",
  accepted: "Düzenlemeyi kabul etti; gönderildi",
  declined: "Düzenlemeyi kabul etmedi",
  approved: "Onayladı; gönderildi",
  rejected: "Reddetti",
  expired: "7 gün içinde karar verilmediği için süresi doldu; gönderilmedi",
};

export function eventLabel(event: Pick<ApprovalEvent, "kind">): string {
  return EVENT_LABEL[event.kind] ?? event.kind;
}

/** Who did it: SkyMail expires a request. */
export function eventActorName(event: Pick<ApprovalEvent, "actor">): string {
  return event.actor ? event.actor.name?.trim() || UNKNOWN_PERSON : "SkyMail";
}

// A Map, not an object literal: a problem comes from the API, and a newer one
// must not find what every object inherits.
const NOTIFICATION_PROBLEM: ReadonlyMap<string, (notification: ApprovalNotification) => string> = new Map<string, (notification: ApprovalNotification) => string>([
  [
    "no_approvers",
    () =>
      "Onaycılara bildirim gitmedi: skymail:mails:approve rolü olan ve e-posta adresi bilinen kimse yok. İstek yine de bekliyor; bir onaycıya haber ver.",
  ],
  [
    "approver_lookup_failed",
    () => "Onaycılar Keycloak'tan zamanında alınamadı; bildirim gitmedi. İstek yine de bekliyor; bir onaycıya haber ver.",
  ],
  ["no_address", () => "Sunanın e-posta adresi bilinmiyor; karar ona mail olarak gitmedi, bu sayfadan görebilir."],
  ["unverified_address", () => "Sunanın e-posta adresi Keycloak'ta doğrulanmamış; karar ona mail olarak gitmedi, bu sayfadan görebilir."],
  ["template_unavailable", (notification) => `Bildirim maili gönderilemedi: ${notification.template_key} System template'i SkyMail'de yok.`],
  ["enqueue_failed", () => "Bildirim maili kuyruğa yazılamadı; kimseye haber gitmedi."],
]);

/** Who an action's notification did not reach, and why; null when it reached everyone it was for. */
export function notificationNote(notification: ApprovalNotification | undefined | null): string | null {
  if (!notification?.problem) return null;
  const say = NOTIFICATION_PROBLEM.get(notification.problem);
  return say ? say(notification) : `Bildirim maili herkese gitmedi (${notification.problem}).`;
}
