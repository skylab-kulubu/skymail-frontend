import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiErrorFromResponse } from "../api/errors";
import { approvalRequest, composePrefill } from "../mail-approvals/edit";
import {
  COMMERCIAL_STATEMENT,
  PURPOSE_REFUSALS,
  PURPOSE_START,
  TRANSACTIONAL_STATEMENT,
  approvalPurposeText,
  categoryOf,
  categoryTeam,
  listConsentAvailable,
  ownEventOffered,
  parseCategory,
  purposeAvailable,
  purposeChoiceOf,
  purposeFields,
  purposeOf,
  purposeProblem,
  purposeText,
  statementText,
  teamNames,
  teamOptions,
} from "./purpose";
import { sendFailure, sendPlan, type SendDraft } from "./send";
import type { MailTemplate } from "../templates";

const GROUP = "8F2C4D1E-1B2A-4C3D-9E8F-0A1B2C3D4E5F";
const group = { id: GROUP, name: "Ar-Ge ekibi", external: true };
const internal = { id: "0b8c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d", name: "Gönüllüler", external: false };
const ticked = { ...PURPOSE_START, commercialAbsent: true };

describe("a send's purpose", () => {
  it("is on only when the backend says so", () => {
    assert.equal(purposeAvailable({ purpose_available: true }), true);
    assert.equal(purposeAvailable({ purpose_available: false }), false);
    assert.equal(purposeAvailable({}), false);
  });

  it("is a duyuru to a list or a group, whatever was chosen; people and a Forms source choose", () => {
    const islem = { ...PURPOSE_START, purpose: "islem" as const };
    assert.equal(purposeOf(islem, "list"), "duyuru");
    assert.equal(purposeOf(islem, "people"), "islem");
    assert.equal(purposeOf(islem, "form"), "islem");
    assert.equal(purposeOf(PURPOSE_START, "people"), "duyuru");
  });

  it("writes core's category, a team's id in lower case", () => {
    assert.equal(categoryOf("club", "haber"), "club:haber");
    assert.equal(categoryOf(GROUP, "duyuru"), `team:${GROUP.toLowerCase()}:duyuru`);
    assert.deepEqual(parseCategory(`team:${GROUP.toLowerCase()}:haber`), { source: GROUP.toLowerCase(), kind: "haber" });
    assert.deepEqual(parseCategory("club:duyuru"), { source: "club", kind: "duyuru" });
    assert.equal(parseCategory("team:x:duyuru"), null);
    assert.equal(parseCategory(null), null);
  });

  it("puts a group send in the group's category until the sender picks another", () => {
    assert.equal(purposeFields(ticked, "list", group).category, `team:${GROUP.toLowerCase()}:duyuru`);
    assert.equal(purposeFields(ticked, "list", internal).category, "club:duyuru");
    assert.equal(purposeFields({ ...ticked, source: "club" }, "list", group).category, "club:duyuru");
    assert.equal(purposeFields({ ...ticked, kind: "haber" }, "people", null).category, "club:haber");
  });

  it("sends a duyuru with its category and the commercial statement, an islem with its statement and no category", () => {
    assert.deepEqual(purposeFields(ticked, "list", internal), { purpose: "duyuru", category: "club:duyuru", commercial_content_absent: true });
    assert.deepEqual(purposeFields({ ...PURPOSE_START, purpose: "islem", transactional: true }, "form", null), {
      purpose: "islem",
      transactional_statement: true,
    });
  });

  it("states a list's own event only for a list, while the backend holds its guests to their consent", () => {
    const own = { ...ticked, ownEvent: true };
    assert.deepEqual(purposeFields(own, "list", internal, true), {
      purpose: "duyuru",
      category: "club:duyuru",
      commercial_content_absent: true,
      own_event_statement: true,
    });
    assert.equal(purposeFields(own, "list", internal, false).own_event_statement, undefined);
    assert.equal(purposeFields(own, "people", null, true).own_event_statement, undefined);
    assert.equal(purposeFields(ticked, "list", internal, true).own_event_statement, undefined);
    assert.equal(ownEventOffered("list", true), true);
    assert.equal(ownEventOffered("form", true), false);
    assert.equal(listConsentAvailable({ list_consent_available: true }), true);
    assert.equal(listConsentAvailable({}), false);
    assert.equal(purposeChoiceOf({ purpose: "duyuru", category: "club:duyuru", commercial_content_absent: true, own_event_statement: true }).ownEvent, true);
  });

  it("does not go without the statement its purpose needs, nor without a team once Ekip is picked", () => {
    assert.equal(purposeProblem(PURPOSE_START, "list", internal), "Tanıtım beyanını işaretle.");
    assert.equal(purposeProblem(ticked, "list", internal), null);
    assert.equal(purposeProblem({ ...PURPOSE_START, purpose: "islem" }, "people", null), "Beyanı işaretle.");
    assert.equal(purposeProblem({ ...PURPOSE_START, purpose: "islem", transactional: true }, "people", null), null);
    // An islem chosen for people does not hold a list send back: there it is a duyuru.
    assert.equal(purposeProblem({ ...PURPOSE_START, purpose: "islem", transactional: true }, "list", internal), "Tanıtım beyanını işaretle.");
    assert.equal(purposeProblem({ ...ticked, team: true, source: null }, "people", null), "Ekip seç.");
    assert.equal(purposeProblem({ ...ticked, team: true, source: null }, "list", group), null);
  });

  it("offers the Keycloak groups as teams and names them back", () => {
    assert.deepEqual(teamOptions([group, internal]), [{ value: GROUP.toLowerCase(), label: "Ar-Ge ekibi" }]);
    assert.equal(teamNames([group])(GROUP), "Ar-Ge ekibi");
  });

  it("says the purpose and the statement in words", () => {
    const team = teamNames([group]);
    assert.equal(purposeText({ purpose: "duyuru", category: "club:haber" }), "Duyuru · Kulüp geneli · Haber");
    assert.equal(purposeText({ purpose: "duyuru", category: `team:${GROUP.toLowerCase()}:duyuru` }, team), "Duyuru · Ekip: Ar-Ge ekibi · Duyuru");
    assert.equal(purposeText({ purpose: "islem" }), "Başvuruyla ilgili bilgi");
    assert.equal(purposeText({ purpose: null }), null);
    assert.equal(statementText({ purpose: "duyuru", commercial_content_absent: true }), COMMERCIAL_STATEMENT);
    assert.equal(statementText({ purpose: "islem", transactional_statement: true }), TRANSACTIONAL_STATEMENT);
    assert.equal(statementText({}), null);
  });

  it("shows a list or group request as a duyuru on its page, once the backend takes a purpose", () => {
    assert.equal(approvalPurposeText({ purpose: null, audienceKind: "mailing_list" }, { available: true }), "Duyuru");
    assert.equal(approvalPurposeText({ purpose: null, audienceKind: "mailing_list" }, { available: false }), null);
    assert.equal(approvalPurposeText({ purpose: null, audienceKind: "people" }, { available: true }), null);
    assert.equal(approvalPurposeText({ purpose: "islem", audienceKind: "single" }, { available: true }), "Başvuruyla ilgili bilgi");
  });

  it("fills the form back from a stored request", () => {
    assert.deepEqual(purposeChoiceOf({ purpose: "islem", transactional_statement: true }), { ...PURPOSE_START, purpose: "islem", transactional: true });
    assert.deepEqual(purposeChoiceOf({ purpose: "duyuru", category: `team:${GROUP.toLowerCase()}:haber`, commercial_content_absent: true }), {
      ...PURPOSE_START,
      source: GROUP.toLowerCase(),
      team: true,
      kind: "haber",
      commercialAbsent: true,
    });
    assert.deepEqual(purposeChoiceOf({}), PURPOSE_START);
  });
});

const TEMPLATE = {
  id: "t1",
  key: "club.note",
  name: "Not",
  subject: "Not",
  html_content: "<p>Merhaba</p>",
  system: false,
  contract_required_variables: [],
  operator_required_variables: [],
} as unknown as MailTemplate;

const draft = (change: Partial<SendDraft>): SendDraft => ({
  what: "template",
  template: TEMPLATE,
  fields: { values: {}, rich: {} },
  audience: "list",
  list: internal,
  people: [],
  ...change,
});

describe("a send plan with a purpose", () => {
  it("carries the purpose on every request, and nothing without one", () => {
    const fields = purposeFields(ticked, "list", internal);
    const list = sendPlan(draft({ purpose: fields }));
    assert.ok(list.ok && list.plan.kind === "list");
    assert.deepEqual(
      { purpose: list.plan.request.purpose, category: list.plan.request.category, commercial_content_absent: list.plan.request.commercial_content_absent },
      fields,
    );

    const islem = purposeFields({ ...PURPOSE_START, purpose: "islem", transactional: true }, "people", null);
    const people = sendPlan(draft({ audience: "people", list: null, people: [{ name: "Ayşe", email: "ayse@example.com" }], purpose: islem }));
    assert.ok(people.ok && people.plan.kind === "people");
    assert.equal(people.plan.requests[0].purpose, "islem");
    assert.equal(people.plan.requests[0].transactional_statement, true);
    assert.equal(people.plan.requests[0].category, undefined);

    const request = approvalRequest(people.plan, { lists: true });
    assert.ok(request.ok);
    assert.equal(request.request.purpose, "islem");
    assert.equal(request.request.transactional_statement, true);
    assert.ok(!("category" in request.request));

    const none = sendPlan(draft({ purpose: null }));
    assert.ok(none.ok && none.plan.kind === "list");
    assert.ok(!("purpose" in none.plan.request));
  });

  it("is filled back from a request for approval", () => {
    const prefill = composePrefill(
      {
        template: { id: "t1", version_id: "v1", name: "Not", key: "club.note", republished: false },
        audience: { kind: "single", mail_list_id: null, name: null, source: null, recipient_full_name: "Ayşe", recipient_email: "ayse@example.com" },
        recipients: [{ full_name: "Ayşe", email: "ayse@example.com" }],
        body_variables: {},
        purpose: "islem",
        transactional_statement: true,
      },
      { templates: [TEMPLATE], lists: [], access: { list: false } as never },
    );
    assert.equal(prefill.purpose?.purpose, "islem");
    assert.equal(prefill.purpose?.transactional, true);
  });
});

describe("a refused purpose", () => {
  const checking = { canSeeSends: true };

  it("says each code the backend names, and keeps the code", () => {
    for (const code of PURPOSE_REFUSALS) {
      const failure = sendFailure(apiErrorFromResponse(400, JSON.stringify({ code, message: "x" })), "list", checking);
      assert.equal(failure.kind, "final");
      assert.equal(failure.code, code);
      assert.ok(!failure.reason.startsWith("Gönderilen bilgiler"), `${code}: ${failure.reason}`);
    }
    const unknown = sendFailure(apiErrorFromResponse(400, JSON.stringify({ code: "mail_task.category_unknown" })), "list", checking);
    assert.equal(unknown.reason, "Bu grup bir ekip değil; kulüp genelini ya da bir ekip seç.");
  });

  it("may be sent again when core's preferences could not be read: nothing was queued", () => {
    const failure = sendFailure(apiErrorFromResponse(503, JSON.stringify({ code: "mail_task.preference_unavailable" })), "list", checking);
    assert.deepEqual(failure, {
      kind: "notSent",
      reason: "İletişim tercihleri şu an okunamıyor. Birkaç dakika sonra yeniden dene.",
      code: "mail_task.preference_unavailable",
    });
    // Any other 503 may still have opened the send.
    assert.equal(sendFailure(apiErrorFromResponse(503, "{}"), "list", checking).kind, "uncertain");
  });
});

describe("the team a request's category names", () => {
  const team = "0f8b6d2e-1c3a-4b5d-9e7f-a1b2c3d4e5f6";
  it("is read unless it is the club, none, or the group already named", () => {
    assert.equal(categoryTeam(`team:${team}:haber`, null), team);
    assert.equal(categoryTeam(`team:${team}:haber`, team.toUpperCase()), null);
    assert.equal(categoryTeam("club:haber", null), null);
    assert.equal(categoryTeam(null, null), null);
  });
});
