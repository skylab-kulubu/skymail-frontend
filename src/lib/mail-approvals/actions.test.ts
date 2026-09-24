/**
 * What a viewer can do with a request (ticket 20), as the API decides it
 * (ticket 19): an approver decides a pending request — their own too
 * (Yusuf, 2026-09-23) — the submitter answers a returned edit and resubmits a
 * rejected or declined request, and nobody acts on an expired or approved
 * one. A request past its deadline is expired whatever its state says, and a
 * template published again since submission cannot be sent as submitted.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { approvalViewer, viewerActions } from "./actions";
import type { ApprovalItem, ApprovalState } from "./approvals";

const NOW = new Date("2026-09-23T09:00:00Z");
const SUBMITTER = "11111111-0000-4000-8000-000000000001";
const APPROVER = "22222222-0000-4000-8000-000000000002";

function request(state: ApprovalState, overrides: { deadlineIn?: number; republished?: boolean; submitter?: string } = {}) {
  const item: Pick<ApprovalItem, "state" | "deadline_at" | "submitter" | "template"> = {
    state,
    deadline_at: new Date(NOW.getTime() + (overrides.deadlineIn ?? 3 * 24 * 3600_000)).toISOString(),
    submitter: { sub: overrides.submitter ?? SUBMITTER, name: "Ayşe Yılmaz", email: "ayse@ornek.com" },
    template: { id: "t", version_id: "v", name: "Duyuru", key: "free.basic", republished: overrides.republished ?? false },
  };
  return item;
}

const approver = { sub: APPROVER, approver: true };
const submitter = { sub: SUBMITTER, approver: false };
const bystander = { sub: "33333333-0000-4000-8000-000000000003", approver: false };

describe("what an approver can do", () => {
  it("approves, edits or rejects a pending request", () => {
    assert.deepEqual(viewerActions(request("pending"), approver, NOW), {
      state: "pending",
      actions: ["approve", "edit", "reject"],
      mine: false,
      republished: false,
    });
  });

  it("decides their own request too, which the history then shows", () => {
    const own = viewerActions(request("pending", { submitter: APPROVER }), approver, NOW);
    assert.deepEqual(own.actions, ["approve", "edit", "reject"]);
    assert.equal(own.mine, true);
  });

  // Approving would send a version other than the one submitted; the API
  // refuses it (mail_approval.template_republished), and so does an edit
  // sent or returned on top of it. Rejecting lets the submitter resubmit.
  it("only rejects a request whose template was published again since", () => {
    assert.deepEqual(viewerActions(request("pending", { republished: true }), approver, NOW), {
      state: "pending",
      actions: ["reject"],
      mine: false,
      republished: true,
    });
  });

  it("does nothing with a request once it is not pending: returned, decided or expired", () => {
    for (const state of ["returned", "approved", "rejected", "declined", "expired"] as const) {
      assert.deepEqual(viewerActions(request(state), approver, NOW).actions, [], state);
    }
  });

  it("does nothing with a pending request past its deadline, which is expired", () => {
    assert.deepEqual(viewerActions(request("pending", { deadlineIn: -1 }), approver, NOW), {
      state: "expired",
      actions: [],
      mine: false,
      republished: false,
    });
  });
});

describe("what the submitter can do", () => {
  it("waits on a pending request", () => {
    assert.deepEqual(viewerActions(request("pending"), submitter, NOW).actions, []);
  });

  it("accepts or declines an edit an approver returned", () => {
    assert.deepEqual(viewerActions(request("returned"), submitter, NOW).actions, ["accept", "decline"]);
    assert.deepEqual(viewerActions(request("returned", { republished: true }), submitter, NOW).actions, ["decline"]);
    assert.deepEqual(viewerActions(request("returned", { deadlineIn: -1 }), submitter, NOW).actions, ["copy"]);
  });

  it("edits and resubmits a rejected or declined request", () => {
    assert.deepEqual(viewerActions(request("rejected"), submitter, NOW).actions, ["resubmit"]);
    assert.deepEqual(viewerActions(request("declined"), submitter, NOW).actions, ["resubmit"]);
  });

  // An expired request is final: it is never sent and cannot be resubmitted.
  // A new one can start from its values.
  it("starts a new request from an expired one", () => {
    assert.deepEqual(viewerActions(request("expired"), submitter, NOW).actions, ["copy"]);
  });

  it("does nothing with a request that went out", () => {
    assert.deepEqual(viewerActions(request("approved"), submitter, NOW).actions, []);
  });

  it("answers their own returned request as its submitter even when they hold the approver role", () => {
    const both = { sub: SUBMITTER, approver: true };
    assert.deepEqual(viewerActions(request("returned"), both, NOW).actions, ["accept", "decline"]);
    assert.deepEqual(viewerActions(request("pending"), both, NOW).actions, ["approve", "edit", "reject"]);
  });
});

describe("what anyone else can do", () => {
  it("is nothing: a request is its submitter's and the approvers'", () => {
    for (const state of ["pending", "returned", "approved", "rejected", "declined", "expired"] as const) {
      assert.deepEqual(viewerActions(request(state), bystander, NOW).actions, [], state);
    }
    assert.deepEqual(viewerActions(request("rejected"), { sub: null, approver: false }, NOW).actions, []);
  });
});

describe("the viewer of a request", () => {
  it("is their subject, and whether they hold the approver's role with access", () => {
    assert.deepEqual(approvalViewer(["skymail:access", "skymail:mails:approve"], { sub: APPROVER }), { sub: APPROVER, approver: true });
    assert.deepEqual(approvalViewer(["skymail:mails:approve"], { sub: SUBMITTER }), { sub: SUBMITTER, approver: false });
    assert.deepEqual(approvalViewer(["skymail:access"], {}), { sub: null, approver: false });
  });
});
