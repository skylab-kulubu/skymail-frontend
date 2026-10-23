/**
 * Open and click tracking on the send form (hub ticket iletisim-servisi 15a;
 * Yusuf 2026-10-20: people too). skymail-backend takes `tracking: true` on
 * `POST /mail_tasks`, on a person's `POST /mail_tasks/single` and on a request
 * for approval to a list or to people, and answers whether the send got it.
 * It tracks only while `SKYMAIL_TRACKING=on` (`GET /mail_tasks/summary`
 * tracking_available) and never a System template (account and transaction
 * mails) or a sensitive one; to people, a template that says nothing of its
 * content counts as sensitive. Each recipient is then decided on their own:
 * a person typed in is tracked only if Keycloak has one enabled account with
 * that verified primary e-mail (the backend looks it up when the send is
 * queued); an internal list's addresses are not looked up (no_account). A
 * Forms send is not offered the box. The box starts unticked.
 *
 * While SkyMail tracks every send a person makes (`SKYMAIL_TRACKING_OPERATOR`,
 * summary `tracking_always`; Yusuf 2026-10-21: no box, no opting out per
 * send) the form shows no box: every list and people send asks for tracking
 * and the backend tracks it whatever the template (a sensitive one with the
 * open pixel only). A Forms send is still not tracked.
 */
import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { formatCount, type SendSummary } from "../sends";
import type { MailTemplate } from "../templates";
import type { ListRow } from "../mailing-lists";
import { purposeAvailable } from "./purpose";
import type { PersonOutcome, SendPlan, SingleSendRequest } from "./send";

export const TRACKING_LABEL = "Açılma ve tıklama takibi";

/** What a send that asked for tracking says when it came back untracked. */
export const TRACKING_NOT_APPLIED = "Takip açılmadı: SkyMail'de takip kapalı ya da bu template takip edilmiyor.";

/** Whether the summary says SkyMail's tracking is on: only a `true` does; a missing field (an older backend) does not. */
export function trackingAvailable(summary: Pick<SendSummary, "tracking_available">): boolean {
  return summary.tracking_available === true;
}

/** Whether SkyMail tracks every send a person makes: only a `true` beside tracking on does; a missing field (an older backend) does not. */
export function trackingAlways(summary: Pick<SendSummary, "tracking_available" | "tracking_always">): boolean {
  return trackingAvailable(summary) && summary.tracking_always === true;
}

/**
 * SkyMail's tracking as the send form reads it: on (the box may be offered),
 * and always (no box, every send tracked); and, read from the same answer,
 * whether a send carries its purpose (purpose.ts).
 */
export type TrackingMode = Readonly<{ available: boolean; always: boolean; purpose: boolean }>;

/** What the form assumes while the summary loads, fails or may not be read: no box, nothing asked, no purpose. */
export const TRACKING_UNKNOWN: TrackingMode = { available: false, always: false, purpose: false };

type ModeAnswer = Pick<SendSummary, "tracking_available" | "tracking_always" | "purpose_available">;

const modeOf = (answer: ModeAnswer): TrackingMode => ({
  available: trackingAvailable(answer),
  always: trackingAlways(answer),
  purpose: purposeAvailable(answer),
});

/**
 * What a backend before `GET /mail_tasks/tracking-mode` answers it: the path
 * falls to `GET /mail_tasks/:id`, which refuses one without mails:read (403)
 * and fails the id as a server error (500) for one with it; 404 in case.
 */
const BEFORE_TRACKING_MODE: ReadonlySet<number> = new Set([403, 404, 500]);

/**
 * SkyMail's tracking. One who may read the summary (mails:read) reads it from
 * the smallest summary (a day, a send), which every backend answers and a new
 * one says `tracking_always` in. Anyone else asks `GET /mail_tasks/tracking-mode`,
 * which anyone who may use SkyMail reads (a setting, not a send: someone who
 * only submits for approval sees it too); a backend before it answers 403,
 * 404 or 500, and then the form knows nothing.
 */
export async function fetchTrackingMode(api: ApiClient, { canReadSummary, signal }: { canReadSummary: boolean; signal?: AbortSignal }): Promise<TrackingMode> {
  if (canReadSummary) {
    return modeOf(await api.get<SendSummary>("/mail_tasks/summary", { query: { days: 1, recent: 1 }, signal }));
  }
  try {
    return modeOf(await api.get<ModeAnswer>("/mail_tasks/tracking-mode", { signal }));
  } catch (error) {
    if (error instanceof ApiError && BEFORE_TRACKING_MODE.has(error.status)) return TRACKING_UNKNOWN;
    throw error;
  }
}

/** A template's sends may be tracked: neither a System template nor sensitive (skymail-backend GetTemplateTrackingExclusion). */
export type TrackableTemplate = Pick<MailTemplate, "system" | "content_sensitive" | "content_sensitive_locked">;

/** Who a send goes to, as tracking reads it: a list, or people one by one. */
export type TrackingAudience = "list" | "people";

/**
 * Whether a template's sends to `audience` may be tracked: never a System or
 * sensitive template; to people, only one that says its content may be shown
 * (a template that says nothing counts as sensitive for one person).
 */
export function templateTrackable(template: TrackableTemplate, audience: TrackingAudience = "list"): boolean {
  if (template.system || template.content_sensitive === true || template.content_sensitive_locked === true) return false;
  return audience === "list" || template.content_sensitive === false;
}

/** Whether the form offers the tracking box for this send: never while every send is tracked anyway. */
export function trackingOffered({
  available,
  always = false,
  audience,
  template,
}: {
  available: boolean;
  always?: boolean;
  audience: "list" | "people" | "form";
  template: TrackableTemplate | null;
}): boolean {
  return available && !always && audience !== "form" && template !== null && templateTrackable(template, audience);
}

/**
 * Whether the send asks for tracking: a list or people send while SkyMail
 * tracks every one, whatever its template and with no box; otherwise only
 * when the box is offered and ticked. A Forms send never asks.
 */
export function trackingAsked({
  mode,
  audience,
  template,
  ticked,
}: {
  mode: Pick<TrackingMode, "available" | "always">;
  audience: "list" | "people" | "form";
  template: TrackableTemplate | null;
  ticked: boolean;
}): boolean {
  if (audience === "form") return false;
  if (mode.available && mode.always) return true;
  return ticked && trackingOffered({ available: mode.available, audience, template });
}

/**
 * How many of a tracked send's recipients have no account, and so are not
 * tracked, as far as the form knows before it goes: every member of an
 * internal list (null while its size is unknown), none of a Keycloak group's;
 * of people typed in, and of a Forms source's respondents, it cannot know —
 * the backend finds their accounts when the send is queued — so null.
 */
export function untrackedCount(plan: SendPlan, list: Pick<ListRow, "external"> | null, size: number | null): number | null {
  if (plan.kind === "list") return list?.external ? 0 : size;
  return null;
}

/**
 * What the confirmation says of the recipients a tracked send will not
 * track for want of an account: `count` of them, or the rule alone when the
 * count is not known before the send. A Keycloak group's members all have one.
 */
export function untrackedRecipientsNote(count: number | null): string | null {
  if (count === 0) return null;
  return count === null ? "Hesabı olmayan alıcılar takip edilmez." : `Hesabı bilinmeyen ${formatCount(count)} alıcı takip edilmez.`;
}

/** What to say of a send that asked for tracking and was answered untracked; null otherwise, or when the answer has no field. */
export function trackingDropped(asked: boolean | undefined, answered: boolean | undefined): string | null {
  return asked === true && answered === false ? TRACKING_NOT_APPLIED : null;
}

/** What to say of a send to people that asked for tracking when a sent one came back untracked; null otherwise. */
export function peopleTrackingDropped(requests: readonly Pick<SingleSendRequest, "tracking">[], outcomes: readonly PersonOutcome[]): string | null {
  const asked = requests.some((request) => request.tracking === true);
  return asked && outcomes.some((outcome) => outcome.status === "sent" && outcome.tracking === false) ? TRACKING_NOT_APPLIED : null;
}
