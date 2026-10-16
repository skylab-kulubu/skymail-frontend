import assert from "node:assert/strict";
import { it } from "node:test";
import { json, scriptedClient } from "./api/testing";
import { audienceFormSource, fetchFormSource, formResponsesHref } from "./form-mail-source";
import { audienceLabel, type SendAudience } from "./sends";
import { approvalAudience } from "./mail-approvals/approvals";
import { composePrefill } from "./mail-approvals/edit";
import { sendAccess } from "./send-form/access";

const id = "3f0c1a52-7b7e-4c1d-9a55-0d6f3b2c1e10";
const formId = "a16bec36-7243-4bb7-82dd-c3c4a2315a78";
const now = Date.parse("2026-10-17T00:00:00Z");
const source = { id, form_id: formId, owner_sub: "fixture", form_title: "Fixture form", recipient_count: 101, response_count: 103, skipped_count: 1, duplicate_count: 1, prepared_at: "2026-10-16T23:59:00Z", expires_at: "2026-10-17T00:29:00Z" };

it("loads the owner-authorized source with 101+ recipients without fetching addresses", async () => {
  const { api, calls } = scriptedClient(json(200, source));
  assert.deepEqual(await fetchFormSource(api, id, formId, "fixture", undefined, now), source);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith(`/form_mail_sources/${id}`));
  assert.equal(calls[0].method, "GET");
});

it("rejects a forged owner, source, form, inconsistent counts or expired API descriptor", async () => {
  for (const changed of [{ owner_sub: "other" }, { id: formId }, { form_id: id }, { response_count: 101 }, { recipient_count: 0 }, { expires_at: "2026-10-16T23:59:30Z" }]) {
    const { api } = scriptedClient(json(200, { ...source, ...changed }));
    await assert.rejects(fetchFormSource(api, id, formId, "fixture", undefined, now));
  }
});

it("builds a Forms link from the configured origin and a canonical UUID only", () => {
  assert.equal(formResponsesHref("https://forms.example.test/admin", formId), `https://forms.example.test/admin/forms/${formId}/responses`);
  assert.equal(formResponsesHref("javascript:alert(1)", formId), null);
  assert.equal(formResponsesHref("https://forms.example.test", "https://foreign.example"), null);
});

const audience: SendAudience = { kind: "form", source: "forms", mail_list_id: null, name: source.form_title, recipient_full_name: null, recipient_email: null, form_source_id: id, form_id: formId, recipient_count: 101, prepared_at: source.prepared_at };

it("readback keeps the form identity rather than turning source recipients into editable people", () => {
  const recipients = [{ full_name: "Fixture", email: "fixture@example.test" }];
  assert.equal(approvalAudience({ audience, recipients }).kind, "form");
  assert.equal(audienceLabel(audience).formId, formId);
  const prefill = composePrefill({ audience, recipients, template: { id: "missing", version_id: "v", name: "Fixture template", key: null, republished: false }, body_variables: {} }, { templates: [], lists: [], access: sendAccess([]) });
  assert.equal(prefill.audience, "form");
  assert.equal(prefill.formSource?.id, id);
  assert.deepEqual(prefill.people, []);
  assert.equal(prefill.listId, null);
  assert.equal(audienceFormSource({ ...audience, form_source_id: undefined }), null);
});
