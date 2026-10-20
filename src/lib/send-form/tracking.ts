/**
 * Open and click tracking on the send form (hub ticket iletisim-servisi 15a;
 * Yusuf 2026-10-20: people too). skymail-backend takes `tracking: true` on
 * `POST /mail_tasks`, on a person's `POST /mail_tasks/single` and on a request
 * for approval to a list or to people, and answers whether the send got it.
 * It tracks only while `SKYMAIL_TRACKING=on` (`GET /mail_tasks/summary`
 * tracking_available) and never a System template (account and transaction
 * mails) or a sensitive one; to people, a template that says nothing of its
 * content counts as sensitive. Each recipient is then decided on their own:
 * one known by address only — an internal list's, a person typed in — is not
 * tracked (no_account). A Forms source's respondents are known by address
 * only, so a Forms send is not offered the box. The box starts unticked.
 */
import type { ApiClient } from "../api/client";
import { formatCount, type SendSummary } from "../sends";
import type { MailTemplate } from "../templates";
import type { ListRow } from "../mailing-lists";
import type { PersonOutcome, SendPlan, SingleSendRequest } from "./send";

export const TRACKING_LABEL = "Açılma ve tıklama takibi";

/** What a send that asked for tracking says when it came back untracked. */
export const TRACKING_NOT_APPLIED = "Takip açılmadı: SkyMail'de takip kapalı ya da bu template takip edilmiyor.";

/** Whether the summary says SkyMail's tracking is on: only a `true` does; a missing field (an older backend) does not. */
export function trackingAvailable(summary: Pick<SendSummary, "tracking_available">): boolean {
  return summary.tracking_available === true;
}

/** Whether SkyMail's tracking is on, from the smallest summary (a day, a send). */
export async function fetchTrackingAvailable(api: ApiClient, signal?: AbortSignal): Promise<boolean> {
  const summary = await api.get<SendSummary>("/mail_tasks/summary", { query: { days: 1, recent: 1 }, signal });
  return trackingAvailable(summary);
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

/** Whether the form offers the tracking box for this send. */
export function trackingOffered({
  available,
  audience,
  template,
}: {
  available: boolean;
  audience: "list" | "people" | "form";
  template: TrackableTemplate | null;
}): boolean {
  return available && audience !== "form" && template !== null && templateTrackable(template, audience);
}

/**
 * How many of a tracked send's recipients are known by address only, and so
 * not tracked: every person typed in (the form never links one to an
 * account), every member of an internal list (null while its size is
 * unknown); a Keycloak group's members all have an account.
 */
export function untrackedCount(plan: SendPlan, list: Pick<ListRow, "external"> | null, size: number | null): number | null {
  if (plan.kind === "people") return plan.requests.length;
  if (plan.kind === "list") return list?.external ? 0 : size;
  return 0;
}

/**
 * What the confirmation says of the recipients a tracked send will not
 * track because their account is not known: `count` of them, or null when
 * the count is not known. A Keycloak group's members all have one.
 */
export function untrackedRecipientsNote(count: number | null): string | null {
  if (count === 0) return null;
  return count === null ? "Hesabı bilinmeyen alıcılar takip edilmez." : `Hesabı bilinmeyen ${formatCount(count)} alıcı takip edilmez.`;
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
