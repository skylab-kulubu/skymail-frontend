/**
 * A decision on a request (ticket 20) — an approver's approval, edit sent or
 * returned, or rejection; a submitter's acceptance or refusal of a returned
 * edit — as the page confirms it and the API takes it (ticket 19).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DECISIONS, decisionBody } from "./decisions";

const EDIT = { Subject: "Yeni konu", BodyHtml: "<p>x</p>" };

describe("what a decision posts", () => {
  it("is a rejection's reason", () => {
    assert.equal(DECISIONS.reject.path, "reject");
    assert.deepEqual(decisionBody("reject", "Tarih yanlış.", null), { reason: "Tarih yanlış." });
  });

  it("is the edit whole, with a note when there is one, to send or to return", () => {
    assert.equal(DECISIONS.approveEdited.path, "approve");
    assert.deepEqual(decisionBody("approveEdited", "", EDIT), { body_variables: EDIT });
    assert.equal(DECISIONS.return.path, "return");
    assert.deepEqual(decisionBody("return", "Konuyu kısalttım.", EDIT), { body_variables: EDIT, note: "Konuyu kısalttım." });
  });

  // An approval without body_variables sends the request as it stands.
  it("is nothing but a note for an approval as it stands, a refusal of an edit, or an acceptance", () => {
    assert.equal(decisionBody("approve", "", null), undefined);
    assert.deepEqual(decisionBody("approve", "Güzel.", null), { note: "Güzel." });
    assert.deepEqual(decisionBody("decline", "Konu böyle kalsın.", null), { note: "Konu böyle kalsın." });
    assert.equal(decisionBody("decline", "", null), undefined);
    assert.equal(decisionBody("accept", "", null), undefined);
  });
});

describe("how a decision is asked for", () => {
  it("asks a rejection for a reason, the submitter's acceptance for nothing, and the rest for an optional note", () => {
    assert.deepEqual(DECISIONS.reject.text, { required: true, label: "Ret gerekçesi", placeholder: "Sunan neden reddedildiğini görecek." });
    assert.equal(DECISIONS.accept.text, null);
    assert.deepEqual(DECISIONS.decline.text, { required: false, label: "Neden (isteğe bağlı)" });
    assert.deepEqual(DECISIONS.approve.text, { required: false, label: "Sunana not (isteğe bağlı)" });
  });

  it("shows an edit beside what was submitted only when one goes with it, and marks refusals", () => {
    assert.deepEqual(
      Object.entries(DECISIONS)
        .filter(([, decision]) => decision.withEdit)
        .map(([name]) => name),
      ["approveEdited", "return"],
    );
    assert.deepEqual(
      Object.entries(DECISIONS)
        .filter(([, decision]) => decision.refusal)
        .map(([name]) => name),
      ["reject", "decline"],
    );
  });
});
