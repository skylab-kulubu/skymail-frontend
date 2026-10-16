import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formsHandoffMatches, formsRecipients, parseFormsHandoff } from "./forms-handoff";

const now = 1_800_000_000_000;
const binding = { nonce: "d71a2392-1f97-4ffc-b9e4-2a89af4a38e9", formId: "a16bec36-7243-4bb7-82dd-c3c4a2315a78", expires: now + 300_000 };
const subject = "446ca05a-b98b-47e3-bd20-e832d91f3e53";
const query = () => new URLSearchParams({ source: "forms", forms_handoff: binding.nonce, form_id: binding.formId, expires: String(binding.expires) });
const data = () => ({ type: "skyforms:mail:recipients", ...binding, preparedByUserId: subject, formTitle: "Fixture form", recipients: [{ name: "Fixture Person", email: "fixture@example.test" }], responseCount: 3, skippedCount: 1, duplicateCount: 1 });

describe("Forms compose handoff binding", () => {
  it("accepts the bounded canonical source URL", () => assert.deepEqual(parseFormsHandoff(query(), now), binding));
  it("rejects approval or mailing-list mixing", () => {
    for (const key of ["from_approval", "mail_list_id"]) {
      const params = query(); params.set(key, "fixture"); assert.equal(parseFormsHandoff(params, now), null);
    }
  });
  it("rejects malformed, duplicate, absent and foreign source parameters", () => {
    for (const key of ["source", "forms_handoff", "form_id", "expires"]) {
      const absent = query(); absent.delete(key); assert.equal(parseFormsHandoff(absent, now), null);
      const duplicate = query(); duplicate.append(key, duplicate.get(key)!); assert.equal(parseFormsHandoff(duplicate, now), null);
      const invalid = query(); invalid.set(key, "invalid"); assert.equal(parseFormsHandoff(invalid, now), null);
    }
  });
  it("rejects expired, unbounded and non-integer deadlines", () => {
    for (const expiry of [now, now - 1, now + 300_001, Infinity, NaN, now + 0.5]) {
      const params = query(); params.set("expires", String(expiry)); assert.equal(parseFormsHandoff(params, now), null);
    }
  });
  it("matches all binding fields without extending the original deadline", () => {
    assert.equal(formsHandoffMatches(binding, binding, now), true);
    for (const key of ["nonce", "formId", "expires"]) assert.equal(formsHandoffMatches({ ...binding, [key]: "other" }, binding, now), false);
    assert.equal(formsHandoffMatches(binding, binding, binding.expires), false);
    for (const malformed of [null, [], "", 3]) assert.equal(formsHandoffMatches(malformed, binding, now), false);
  });
});

describe("Forms recipients become only a new compose audience", () => {
  it("keeps the real reader identity, source, people and omission counts", () => assert.deepEqual(formsRecipients(data(), binding, subject, now), data()));
  it("does not accept data for a different signed-in person or source form", () => {
    assert.equal(formsRecipients({ ...data(), preparedByUserId: "other" }, binding, subject, now), null);
    assert.equal(formsRecipients({ ...data(), formId: "other" }, binding, subject, now), null);
    assert.equal(formsRecipients({ ...data(), type: "skyforms:mail:ready" }, binding, subject, now), null);
  });
  it("rejects empty, malformed or ambiguous addresses and names", () => {
    for (const recipients of [[], null, {}, [{ name: "Fixture", email: "not-email" }], [{ name: 3, email: "fixture@example.test" }], [{ name: "Fixture", email: " fixture@example.test " }]]) {
      assert.equal(formsRecipients({ ...data(), recipients }, binding, subject, now), null);
    }
  });
  it("rejects negative, unsafe or inconsistent count categories", () => {
    for (const key of ["responseCount", "skippedCount", "duplicateCount"]) {
      for (const count of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "3"]) assert.equal(formsRecipients({ ...data(), [key]: count }, binding, subject, now), null);
    }
    assert.equal(formsRecipients({ ...data(), responseCount: 4 }, binding, subject, now), null);
  });
  it("preserves more than 100 people for the existing approval/list decision", () => {
    const recipients = Array.from({ length: 101 }, (_, i) => ({ name: "Fixture", email: `fixture${i}@example.test` }));
    assert.equal(formsRecipients({ ...data(), recipients, responseCount: 101, skippedCount: 0, duplicateCount: 0 }, binding, subject, now)?.recipients.length, 101);
  });
});
