/**
 * Open and click tracking on the send form (hub ticket iletisim-servisi 15a).
 * skymail-backend takes `tracking: true` on `POST /mail_tasks` and on a
 * request for approval to a list, and answers whether the send got it. It
 * tracks only while `SKYMAIL_TRACKING=on` (`GET /mail_tasks/summary`
 * tracking_available) and never a System template (account and transaction
 * mails) or a sensitive one; people are sent single mails, which are never
 * tracked, and a Forms source's respondents have no account. So the box is
 * offered for a list send of an ordinary template only, and starts unticked.
 */
import type { ApiClient } from "../api/client";
import type { SendSummary } from "../sends";
import type { MailTemplate } from "../templates";

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

/** A template's sends may be tracked: neither a System template nor sensitive (skymail-backend GetTemplateTrackingExclusion, for a send to many). */
export type TrackableTemplate = Pick<MailTemplate, "system" | "content_sensitive" | "content_sensitive_locked">;

export function templateTrackable(template: TrackableTemplate): boolean {
  return !template.system && template.content_sensitive !== true && template.content_sensitive_locked !== true;
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
  return available && audience === "list" && template !== null && templateTrackable(template);
}

/** What to say of a send that asked for tracking and was answered untracked; null otherwise, or when the answer has no field. */
export function trackingDropped(asked: boolean | undefined, answered: boolean | undefined): string | null {
  return asked === true && answered === false ? TRACKING_NOT_APPLIED : null;
}
