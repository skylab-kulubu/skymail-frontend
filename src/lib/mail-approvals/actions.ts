/**
 * What a viewer can do with a request (ticket 20), as the API allows it
 * (ticket 19): approvers (`skymail:mails:approve`) decide a pending request,
 * their own too (Yusuf, 2026-09-23); the submitter answers an edit returned to
 * them and resubmits a rejected or declined request; an expired request is
 * final, and its submitter can start a new one from it. The page offers
 * exactly these, so no button leads to a refusal the viewer could have been
 * spared.
 */
import { effectiveState, type ApprovalItem, type ApprovalState } from "./approvals";

export type ApprovalAction =
  /** Approve as it stands: it is sent as submitted. */
  | "approve"
  /** Edit the variables, then send the edit or return it to the submitter. */
  | "edit"
  /** Reject, with a reason. */
  | "reject"
  /** The submitter accepts a returned edit: it is sent as edited. */
  | "accept"
  /** The submitter declines a returned edit. */
  | "decline"
  /** The submitter edits a rejected or declined request and submits it again. */
  | "resubmit"
  /** The submitter starts a new request from an expired one. */
  | "copy";

export type ViewerActions = Readonly<{
  /** The state as it stands now (effectiveState). */
  state: ApprovalState;
  actions: readonly ApprovalAction[];
  /** The viewer submitted it. */
  mine: boolean;
  /** The template was published again since: it cannot be sent as submitted. */
  republished: boolean;
}>;

export type ApprovalViewer = Readonly<{ sub: string | null; approver: boolean }>;

export function viewerActions(
  request: Pick<ApprovalItem, "state" | "deadline_at" | "submitter" | "template">,
  viewer: ApprovalViewer,
  now: Date = new Date(),
): ViewerActions {
  const state = effectiveState(request, now);
  const mine = viewer.sub !== null && viewer.sub === request.submitter.sub;
  const republished = request.template.republished;
  const actions: ApprovalAction[] = [];
  if (viewer.approver && state === "pending") actions.push(...(republished ? (["reject"] as const) : (["approve", "edit", "reject"] as const)));
  if (mine) {
    if (state === "returned") actions.push(...(republished ? (["decline"] as const) : (["accept", "decline"] as const)));
    else if (state === "rejected" || state === "declined") actions.push("resubmit");
    else if (state === "expired") actions.push("copy");
  }
  return { state, actions, mine, republished };
}
