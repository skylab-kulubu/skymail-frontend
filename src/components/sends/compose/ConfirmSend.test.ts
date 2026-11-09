/**
 * A confirmed send goes as the dialog opened (son bakış #162): the plan, the
 * list and what goes are copied when it opens, so another audience or list
 * picked behind the open dialog never reaches the send.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ListRow } from "@/lib/mailing-lists";
import type { ListSendRequest, SingleSendRequest } from "@/lib/send-form/send";
import { confirmedSend, type Confirming } from "./ConfirmSend";

const LIST: ListRow = { id: "3f0c1a52-0000-4000-8000-000000000001", name: "GECEKODU", external: false, groupPath: null, createdAt: null, archivedAt: null };
const REQUEST: ListSendRequest = { template_id: "t", mail_list_id: LIST.id, body_variables: {} };
const PERSON: SingleSendRequest = { template_id: "t", recipient_email: "ali@ornek.com", recipient_full_name: "Ali", body_variables: {} };

describe("a confirmed send", () => {
  it("goes to the list the dialog opened with", () => {
    const opened: Confirming = { kind: "send", plan: { kind: "list", request: REQUEST }, list: LIST, what: "“Duyuru”" };
    assert.deepEqual(confirmedSend(opened), { kind: "list", request: REQUEST, list: LIST, what: "“Duyuru”" });
    const again: Confirming = { kind: "resendList", plan: { kind: "list", request: REQUEST }, list: LIST, what: "x" };
    assert.equal(confirmedSend(again)?.kind, "list");
  });

  it("never sends to a list it does not name", () => {
    assert.equal(confirmedSend({ kind: "send", plan: { kind: "list", request: REQUEST }, list: null, what: "x" }), null);
  });

  it("sends people as planned, and a retry to who is left", () => {
    assert.deepEqual(confirmedSend({ kind: "send", plan: { kind: "people", requests: [PERSON] }, list: null, what: "x" }), {
      kind: "people",
      requests: [PERSON],
      what: "x",
    });
    assert.deepEqual(confirmedSend({ kind: "retryPeople", retry: { requests: [PERSON], uncertain: [], notSent: [] } }), {
      kind: "retry",
      requests: [PERSON],
    });
  });

  it("sends no Team request at once: Teams go only for approval", () => {
    const team: Confirming = {
      kind: "send",
      plan: { kind: "team", teams: [], request: { template_id: "t", team_ids: ["a"], body_variables: {}, commercial_content_absent: true } },
      list: null,
      what: "x",
    };
    assert.equal(confirmedSend(team), null);
  });
});
