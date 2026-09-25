/**
 * The bodies the approval screens send (ticket 20), built from the same
 * variable fields as the send form (ticket 16):
 *
 *  - a submission and a resubmission are the send form's request, to a list
 *    or to 1..100 people as one request (`POST /mail_approvals`,
 *    `…/resubmit`, ticket 22);
 *  - an approver's edit is the request's variables, whole, with only the
 *    fields they changed in their new values: an untouched field goes back
 *    exactly as it came, a free announcement's body too, even where the
 *    Visual editor could not read it back exactly;
 *  - what an edit changed, variable by variable, before and after, for the
 *    confirmation and for the submitter a returned edit waits on;
 *  - the form filled from a request, to resubmit it or start a new one.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freeBodyFromSource } from "../mail-render/free-body";
import { buildVisual as b, visualSource } from "../mail-render/visual-document";
import type { ListRow } from "../mailing-lists";
import { sendAccess } from "../send-form/access";
import type { FieldSource } from "../send-form/fields";
import { FREE_TEMPLATE_KEY, sendPlan, type SendDraft } from "../send-form/send";
import type { MailTemplate } from "../templates";
import { ROLE } from "../access";
import { TEST_BASE_URL, json, scriptedClient } from "../api/testing";
import type { ApprovalEvent, MailApproval } from "./approvals";
import {
  approvalFields,
  approvalRequest,
  composePrefill,
  editedVariables,
  fetchPinnedSource,
  inputFromVariables,
  pinnedSourceNote,
  resubmission,
  valueText,
  valuesBeforeEdit,
  variableChanges,
} from "./edit";

const LIST_ID = "3f0c1a52-0000-4000-8000-000000000001";
const FREE_ID = "7e3a1c00-0000-4000-8000-00000000f4ee";
const REMINDER_ID = "7e3a1c00-0000-4000-8000-000000000001";

const FREE_SOURCE: FieldSource = {
  subject: "{{.Subject}}",
  html_content:
    '{{if .Heading}}<h1>{{.Heading}}</h1>{{end}}<div>{{safeHTML .BodyHtml}}</div>{{if .CtaUrl}}<a href="{{.CtaUrl}}">{{.CtaLabel}}</a>{{end}}',
  contract_required_variables: [],
  operator_required_variables: [],
};

const BODY_HTML = "<h2>Başvurular açıldı</h2><p>Son gün <strong>5 Nisan</strong>.</p>";
const SUBMITTED = { Subject: "GECEKODU başvuruları", Heading: "", BodyHtml: BODY_HTML, CtaUrl: "", CtaLabel: "" };

function template(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    id: REMINDER_ID,
    name: "Etkinlik hatırlatması",
    key: "event.reminder",
    subject: "{{.EventName}} yarın",
    system: false,
    html_content: '<p>Merhaba {{.FullName}}, {{.EventName}} yarın. <a href="{{.DetailsUrl}}">Ayrıntılar</a></p>',
    plain_text_content: "",
    react_email_content: "",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    archived_at: null,
    archived_by: null,
    published_version_id: "9a1b2c00-0000-4000-8000-000000000001",
    main_mode: "html",
    drafts: [],
    contract_required_variables: [],
    operator_required_variables: ["EventName"],
    ...overrides,
  };
}

const FREE = template({ id: FREE_ID, name: "Serbest Gönderim", key: FREE_TEMPLATE_KEY, ...FREE_SOURCE, operator_required_variables: [] });

describe("the fields an approver edits", () => {
  it("are the send form's, from the version the request is pinned to, a free announcement's body in the Visual editor", () => {
    const fields = approvalFields(FREE_SOURCE, SUBMITTED, FREE_TEMPLATE_KEY);
    assert.deepEqual(
      fields.map((field) => [field.name, field.label, field.kind]),
      [
        ["Subject", "Konu", "text"],
        ["Heading", "Başlık", "text"],
        ["BodyHtml", "Gövde", "rich"],
        ["CtaUrl", "Buton bağlantısı", "url"],
        ["CtaLabel", "Buton yazısı", "text"],
      ],
    );
  });

  it("keep a value the request carries that the version does not use, and never ask for what the mailer fills", () => {
    const fields = approvalFields(FREE_SOURCE, { ...SUBMITTED, Extra: "x", FullName: "Ayşe", Email: "a@b.co" }, FREE_TEMPLATE_KEY);
    assert.deepEqual(fields.map((field) => field.name), ["Subject", "Heading", "BodyHtml", "CtaUrl", "CtaLabel", "Extra"]);
  });

  // An approver without templates:read, or a template gone since: the
  // request's own variables, by name. The API still checks Required variables.
  it("are the request's variables by name when the version cannot be read", () => {
    const fields = approvalFields(null, { ...SUBMITTED, FullName: "Ayşe" }, FREE_TEMPLATE_KEY);
    assert.deepEqual(
      fields.map((field) => [field.name, field.label, field.kind, field.required]),
      [
        ["Subject", "Konu", "text", false],
        ["Heading", "Başlık", "text", false],
        ["BodyHtml", "Gövde", "rich", false],
        ["CtaUrl", "Buton bağlantısı", "url", false],
        ["CtaLabel", "Buton yazısı", "text", false],
      ],
    );
    assert.equal(approvalFields(null, { BodyHtml: "<p>x</p>" }, "event.reminder")[0].kind, "text");
  });
});

describe("the form filled from a request's values", () => {
  it("holds each text as it is and a free announcement's body as a Visual source read from its HTML", () => {
    const fields = approvalFields(FREE_SOURCE, SUBMITTED, FREE_TEMPLATE_KEY);
    const { input, inexact } = inputFromVariables(fields, SUBMITTED);
    assert.deepEqual(input.values, { Subject: "GECEKODU başvuruları", Heading: "", CtaUrl: "", CtaLabel: "" });
    assert.deepEqual(Object.keys(input.rich), ["BodyHtml"]);
    const body = freeBodyFromSource(input.rich.BodyHtml);
    assert.ok(body.ok);
    assert.equal(body.html, BODY_HTML);
    assert.deepEqual(inexact, []);
  });

  it("names a body the editor cannot read back exactly", () => {
    const fields = approvalFields(FREE_SOURCE, SUBMITTED, FREE_TEMPLATE_KEY);
    const { inexact } = inputFromVariables(fields, { ...SUBMITTED, BodyHtml: '<div style="color:red">Merhaba</div>' });
    assert.deepEqual(inexact, ["BodyHtml"]);
  });

  it("writes a value that is not text as text, and a missing one as empty", () => {
    const fields = approvalFields(null, { Count: 3, Flag: true, Empty: null }, null);
    assert.deepEqual(inputFromVariables(fields, { Count: 3, Flag: true, Empty: null }).input.values, { Count: "3", Flag: "true", Empty: "" });
  });
});

describe("an approver's edit", () => {
  const fields = approvalFields(FREE_SOURCE, SUBMITTED, FREE_TEMPLATE_KEY);
  const initial = inputFromVariables(fields, SUBMITTED).input;
  const edited = (change: { values?: Record<string, string>; rich?: Record<string, string> }) =>
    editedVariables(fields, SUBMITTED, initial, {
      values: { ...initial.values, ...change.values },
      rich: { ...initial.rich, ...change.rich },
    });

  it("is the request's variables whole, with the changed field in its new value, trimmed", () => {
    assert.deepEqual(edited({ values: { Subject: "  GECEKODU 2026 başvuruları " } }), {
      ok: true,
      variables: { ...SUBMITTED, Subject: "GECEKODU 2026 başvuruları" },
      changed: ["Subject"],
    });
  });

  it("changes nothing when nothing was changed, or a change was taken back", () => {
    assert.deepEqual(edited({}), { ok: true, variables: SUBMITTED, changed: [] });
    assert.deepEqual(edited({ values: { Subject: "GECEKODU başvuruları " } }), { ok: true, variables: SUBMITTED, changed: [] });
  });

  it("sends a body written again in the editor as the editor renders it", () => {
    const rich = visualSource(b.document([b.paragraph([b.text("Yeni metin")])]));
    assert.deepEqual(edited({ rich: { BodyHtml: rich } }), {
      ok: true,
      variables: { ...SUBMITTED, BodyHtml: "<p>Yeni metin</p>" },
      changed: ["BodyHtml"],
    });
  });

  // The editor may write its source again without a change in the mail; the
  // body is changed only when it renders differently.
  it("keeps the body exactly as submitted while the editor's render of it is the same", () => {
    const odd = { ...SUBMITTED, BodyHtml: '<div style="color:red">Merhaba</div>' };
    const start = inputFromVariables(fields, odd).input;
    const rewritten = visualSource(b.document([b.paragraph([b.text("Merhaba")])]));
    const result = editedVariables(fields, odd, start, { ...start, rich: { BodyHtml: rewritten } });
    assert.deepEqual(result, { ok: true, variables: odd, changed: [] });
  });

  it("keeps variables no field asks for as they are", () => {
    const withExtra = { ...SUBMITTED, Secret: "x" };
    const only = fields.filter((field) => field.name === "Subject");
    const start = inputFromVariables(only, withExtra).input;
    const result = editedVariables(only, withExtra, start, { values: { Subject: "Yeni" }, rich: {} });
    assert.deepEqual(result, { ok: true, variables: { ...withExtra, Subject: "Yeni" }, changed: ["Subject"] });
  });

  it("does not empty a Required variable", () => {
    const reminder = approvalFields(template(), { EventName: "GECEKODU", DetailsUrl: "" }, "event.reminder");
    const start = inputFromVariables(reminder, { EventName: "GECEKODU", DetailsUrl: "" }).input;
    assert.deepEqual(editedVariables(reminder, { EventName: "GECEKODU", DetailsUrl: "" }, start, { values: { EventName: " ", DetailsUrl: "" }, rich: {} }), {
      ok: false,
      problems: { EventName: "EventName boş bırakılamaz: bir Required variable." },
    });
  });
});

describe("what an edit changed", () => {
  it("is each variable whose value differs, before and after, in the fields' order", () => {
    assert.deepEqual(
      variableChanges({ a: "1", b: "2", c: "3" }, { a: "1", b: "20", c: "30", d: "4" }, ["c", "b", "a"]),
      [
        { name: "c", before: "3", after: "30" },
        { name: "b", before: "2", after: "20" },
        { name: "d", before: null, after: "4" },
      ],
    );
    assert.deepEqual(variableChanges({ a: "1", b: "2" }, { a: "1" }, []), [{ name: "b", before: "2", after: null }]);
  });

  const event = (seq: number, kind: ApprovalEvent["kind"], changes: ApprovalEvent["changes"] = [], note: string | null = null): ApprovalEvent => ({
    seq,
    kind,
    actor: { sub: "approver", name: "Mehmet Kaya" },
    note,
    changes,
    task_id: null,
    at: "2026-09-23T09:00:00Z",
  });

  // What the submitter weighs when an edit is returned to them: the request
  // before the approver's last edit, beside it now.
  it("gives back the request before the last edit, from the history", () => {
    const approval: Pick<MailApproval, "body_variables" | "history"> = {
      body_variables: { Subject: "Yeni konu", Heading: "Başlık", Added: "x" },
      history: [
        event(1, "submitted"),
        event(2, "edited", [{ field: "variable", name: "Subject", before: "Eski", after: "Eski 2" }]),
        event(3, "rejected"),
        event(4, "resubmitted", [{ field: "variable", name: "Subject", before: "Eski 2", after: "Eski konu" }]),
        event(5, "edited", [
          { field: "variable", name: "Subject", before: "Eski konu", after: "Yeni konu" },
          { field: "variable", name: "Removed", before: "y", after: null },
          { field: "variable", name: "Added", before: null, after: "x" },
        ]),
        event(6, "returned", [], "Konuyu kısalttım."),
      ],
    };
    assert.deepEqual(valuesBeforeEdit(approval), {
      before: { Subject: "Eski konu", Heading: "Başlık", Removed: "y" },
      changes: [
        { name: "Subject", before: "Eski konu", after: "Yeni konu" },
        { name: "Removed", before: "y", after: null },
        { name: "Added", before: null, after: "x" },
      ],
      editor: { sub: "approver", name: "Mehmet Kaya" },
      note: "Konuyu kısalttım.",
    });
  });

  it("is nothing when nothing was edited", () => {
    assert.equal(valuesBeforeEdit({ body_variables: { a: "1" }, history: [event(1, "submitted")] }), null);
    assert.equal(valuesBeforeEdit({ body_variables: null, history: null }), null);
  });
});

describe("a submission from the send form", () => {
  const list: ListRow = { id: LIST_ID, name: "GECEKODU katılımcıları", external: false, groupPath: null, createdAt: null, archivedAt: null };
  const body = visualSource(b.document([b.paragraph([b.text("Merhaba.")])]));
  const draft = (overrides: Partial<SendDraft>): SendDraft => ({
    what: "free",
    template: FREE,
    fields: { values: { Subject: "Duyuru" }, rich: { BodyHtml: body } },
    audience: "list",
    list,
    people: [],
    ...overrides,
  });
  const planOf = (d: SendDraft) => {
    const check = sendPlan(d);
    assert.ok(check.ok);
    return check.plan;
  };

  it("to a list is the list send's own body", () => {
    assert.deepEqual(approvalRequest(planOf(draft({}))), {
      ok: true,
      request: {
        template_id: FREE_ID,
        mail_list_id: LIST_ID,
        body_variables: { Subject: "Duyuru", Heading: "", BodyHtml: "<p>Merhaba.</p>", CtaUrl: "", CtaLabel: "" },
      },
    });
  });

  // The API still takes recipient_email for one person, until ticket 21's follow-up drops it.
  it("to one person names them among the recipients, not in the fields for one", () => {
    const plan = planOf(draft({ audience: "people", list: null, people: [{ name: "Ayşe Yılmaz", email: " ayse@ornek.com " }] }));
    assert.deepEqual(approvalRequest(plan), {
      ok: true,
      request: {
        template_id: FREE_ID,
        recipients: [{ email: "ayse@ornek.com", full_name: "Ayşe Yılmaz" }],
        body_variables: { Subject: "Duyuru", Heading: "", BodyHtml: "<p>Merhaba.</p>", CtaUrl: "", CtaLabel: "" },
      },
    });
  });

  // Approvers decide it once; each person gets a send of their own.
  it("to several people is one request, each in the order the form has them, the empty rows left out", () => {
    const plan = planOf(
      draft({
        audience: "people",
        list: null,
        people: [
          { name: "", email: "b@ornek.com" },
          { name: "", email: "" },
          { name: " Ali Can ", email: "a@ornek.com" },
        ],
      }),
    );
    const submitted = approvalRequest(plan);
    assert.ok(submitted.ok);
    assert.deepEqual("recipients" in submitted.request && submitted.request.recipients, [
      { email: "b@ornek.com", full_name: "" },
      { email: "a@ornek.com", full_name: "Ali Can" },
    ]);
  });

  const crowd = (count: number) => Array.from({ length: count }, (_, index) => ({ name: "", email: `kisi${index + 1}@ornek.com` }));

  it("goes to 100 people at most, and points a crowd to a list", () => {
    const hundred = approvalRequest(planOf(draft({ audience: "people", list: null, people: crowd(100) })), { lists: true });
    assert.ok(hundred.ok);
    assert.equal("recipients" in hundred.request && hundred.request.recipients.length, 100);
    assert.deepEqual(approvalRequest(planOf(draft({ audience: "people", list: null, people: crowd(101) })), { lists: true }), {
      ok: false,
      problem: "Onaya en çok 100 kişi sunulur; burada 101 kişi var. Daha kalabalık bir gönderim için bir mail listesi seç.",
    });
    assert.deepEqual(approvalRequest(planOf(draft({ audience: "people", list: null, people: crowd(101) })), { lists: false }), {
      ok: false,
      problem:
        "Onaya en çok 100 kişi sunulur; burada 101 kişi var. Daha kalabalık bir gönderim bir mail listesine gider: listeleri görmek için skymail:lists:read rolü gerekiyor.",
    });
  });
});

describe("the send form filled from a request", () => {
  const lists: ListRow[] = [{ id: LIST_ID, name: "GECEKODU katılımcıları", external: false, groupPath: null, createdAt: null, archivedAt: null }];
  const approval = (overrides: Partial<MailApproval> = {}): MailApproval => ({
    id: "5d1e7c2a-0000-4000-8000-000000000001",
    state: "rejected",
    submitter: { sub: "s", name: "Ayşe Yılmaz", email: "ayse@ornek.com" },
    template: { id: FREE_ID, version_id: "v", name: "Serbest Gönderim", key: FREE_TEMPLATE_KEY, republished: false },
    audience: { kind: "mailing_list", mail_list_id: LIST_ID, name: "GECEKODU katılımcıları", source: "internal", recipient_full_name: null, recipient_email: null },
    body_variables: SUBMITTED,
    created_at: "2026-09-20T09:00:00Z",
    submitted_at: "2026-09-20T09:00:00Z",
    deadline_at: "2026-09-27T09:00:00Z",
    updated_at: "2026-09-21T09:00:00Z",
    task_id: null,
    last_event: null,
    recipient_count: 3,
    preview: null,
    preview_error: null,
    history: [],
    ...overrides,
  });
  const member = sendAccess([ROLE.access, ROLE.templatesRead, ROLE.listsRead]);

  it("picks the free announcement, the list and the values again", () => {
    const prefill = composePrefill(approval(), { templates: [FREE, template()], lists, access: member });
    assert.equal(prefill.what, "free");
    assert.equal(prefill.templateId, FREE_ID);
    assert.equal(prefill.audience, "list");
    assert.equal(prefill.listId, LIST_ID);
    assert.deepEqual(prefill.people, []);
    assert.deepEqual(prefill.values, { Subject: "GECEKODU başvuruları", Heading: "", CtaUrl: "", CtaLabel: "" });
    const body = freeBodyFromSource(prefill.rich.BodyHtml);
    assert.ok(body.ok);
    assert.equal(body.html, BODY_HTML);
    assert.deepEqual(prefill.notes, []);
  });

  it("picks a template and the one person again", () => {
    const prefill = composePrefill(
      approval({
        template: { id: REMINDER_ID, version_id: "v", name: "Etkinlik hatırlatması", key: "event.reminder", republished: true },
        audience: { kind: "single", mail_list_id: null, name: null, source: null, recipient_full_name: "Ali Can", recipient_email: "ali@ornek.com" },
        body_variables: { EventName: "GECEKODU", DetailsUrl: "https://skyl.app/g" },
      }),
      { templates: [FREE, template()], lists, access: member },
    );
    assert.equal(prefill.what, "template");
    assert.equal(prefill.templateId, REMINDER_ID);
    assert.equal(prefill.audience, "people");
    assert.deepEqual(prefill.people, [{ name: "Ali Can", email: "ali@ornek.com" }]);
    assert.deepEqual(prefill.values, { EventName: "GECEKODU", DetailsUrl: "https://skyl.app/g" });
  });

  it("picks every person again, in the order submitted", () => {
    const people = [
      { full_name: "Ali Can", email: "ali@ornek.com" },
      { full_name: "", email: "zeynep@ornek.com" },
      { full_name: "Mert Demir", email: "mert@ornek.com" },
    ];
    const prefill = composePrefill(
      approval({
        audience: { kind: "people", mail_list_id: null, name: null, source: null, recipient_full_name: null, recipient_email: null },
        recipients: people,
      }),
      { templates: [FREE], lists, access: member },
    );
    assert.equal(prefill.audience, "people");
    assert.equal(prefill.listId, null);
    assert.deepEqual(prefill.people, [
      { name: "Ali Can", email: "ali@ornek.com" },
      { name: "", email: "zeynep@ornek.com" },
      { name: "Mert Demir", email: "mert@ornek.com" },
    ]);
    assert.deepEqual(prefill.notes, []);
  });

  it("says what it could not fill: a template or a list gone, a list the viewer cannot see, a body not read back exactly", () => {
    const gone = composePrefill(
      approval({
        template: { id: "7e3a1c00-0000-4000-8000-00000000dead", version_id: "v", name: "Eski duyuru", key: null, republished: false },
        audience: { kind: "mailing_list", mail_list_id: "3f0c1a52-0000-4000-8000-00000000dead", name: "Eski liste", source: "internal", recipient_full_name: null, recipient_email: null },
      }),
      { templates: [FREE], lists, access: member },
    );
    assert.equal(gone.templateId, null);
    assert.equal(gone.what, "template");
    assert.equal(gone.listId, null);
    assert.deepEqual(gone.notes, [
      "İsteğin Mail template'i (“Eski duyuru”) artık gönderilemiyor: arşivlenmiş ya da silinmiş. Bir template seç.",
      "İsteğin listesi (“Eski liste”) artık yok ya da arşivlenmiş. Bir liste seç.",
    ]);

    const blind = composePrefill(approval(), { templates: [FREE], lists: [], access: sendAccess([ROLE.access, ROLE.templatesRead]) });
    assert.equal(blind.audience, "people");
    assert.deepEqual(blind.notes, ["İstek “GECEKODU katılımcıları” listesine gidiyordu; bu hesap mail listelerini göremiyor (skymail:lists:read). Bir kişi seç."]);

    const odd = composePrefill(approval({ body_variables: { ...SUBMITTED, BodyHtml: "<div>x</div>" } }), { templates: [FREE], lists, access: member });
    assert.deepEqual(odd.notes, ["Gövde Visual editöre birebir aktarılamadı: gönderilmeden önce bak."]);
  });
});

describe("a value as the page shows it", () => {
  it("is a text as it is, and none as nothing", () => {
    assert.equal(valueText("GECEKODU", "text"), "GECEKODU");
    assert.equal(valueText(3, "text"), "3");
    assert.equal(valueText(null, "text"), null);
    assert.equal(valueText(undefined, "rich"), null);
  });

  // A body is shown as its words, a line a block; the preview shows it as mail.
  it("is a free announcement's body as its text, never as markup", () => {
    assert.equal(
      valueText('<h2>Başvurular</h2><p>a &amp; b<br>c <a href="https://x.co">d</a></p><ul><li>e</li><li>f</li></ul><script>x</script>', "rich"),
      "Başvurular\na & b\nc d\n• e\n• f\nx",
    );
  });
});

describe("the version a request is pinned to, read for its fields", () => {
  const pinned = { id: FREE_ID, version_id: "9a1b2c00-0000-4000-8000-000000000002" };

  it("is the version's subject and body, with the template's Required variables", async () => {
    const { api, calls } = scriptedClient(
      json(200, { ...FREE, operator_required_variables: ["Subject"] }),
      json(200, { id: pinned.version_id, subject: "{{.Subject}} (v1)", html_content: "<p>{{.Subject}}</p>" }),
    );
    assert.deepEqual(await fetchPinnedSource(api, pinned), {
      subject: "{{.Subject}} (v1)",
      html_content: "<p>{{.Subject}}</p>",
      contract_required_variables: [],
      operator_required_variables: ["Subject"],
    });
    assert.deepEqual(
      calls.map((call) => call.url),
      [`${TEST_BASE_URL}/templates/${FREE_ID}`, `${TEST_BASE_URL}/templates/${FREE_ID}/versions/${pinned.version_id}`],
    );
  });

  // An archived template answers 404 to every read but its versions'.
  it("is the version alone when the template cannot be read, and nothing when the version cannot", async () => {
    const archived = scriptedClient(
      json(404, { code: "server.not_found" }),
      json(200, { id: pinned.version_id, subject: "S", html_content: "H" }),
    );
    assert.deepEqual(await fetchPinnedSource(archived.api, pinned), {
      subject: "S",
      html_content: "H",
      contract_required_variables: [],
      operator_required_variables: [],
    });
    const gone = scriptedClient(json(404, { code: "server.not_found" }), json(404, { code: "server.not_found" }));
    assert.equal(await fetchPinnedSource(gone.api, pinned), null);
  });
});

describe("what a resubmission starts from", () => {
  const edited = (seq: number): ApprovalEvent => ({
    seq,
    kind: "edited",
    actor: { sub: "approver", name: "Zeynep Arslan" },
    note: null,
    changes: [
      { field: "variable", name: "Subject", before: "Benim konum", after: "Onaycının konusu" },
      { field: "variable", name: "Added", before: null, after: "onaycının" },
    ],
    task_id: null,
    at: "2026-09-23T09:00:00Z",
  });
  const request = (state: MailApproval["state"]) =>
    ({
      state,
      body_variables: { Subject: "Onaycının konusu", Heading: "Başlık", Added: "onaycının" },
      history: [
        { ...edited(1), kind: "submitted", changes: [] },
        edited(2),
        { ...edited(3), kind: state === "declined" ? "declined" : "rejected", changes: [], actor: { sub: "s", name: "Ayşe" } },
      ],
    }) as Pick<MailApproval, "state" | "body_variables" | "history">;

  // The submitter refused the approver's edit: they resubmit from their own values.
  it("is the submitter's own values when they declined an approver's edit", () => {
    assert.deepEqual(resubmission(request("declined")).body_variables, { Subject: "Benim konum", Heading: "Başlık" });
  });

  // A rejected request goes back as it stands, an approver's direct edit included.
  it("is the request as it stands when it was rejected", () => {
    assert.deepEqual(resubmission(request("rejected")).body_variables, { Subject: "Onaycının konusu", Heading: "Başlık", Added: "onaycının" });
  });
});

describe("why the mail is not shown both ways", () => {
  // Someone who may read templates is not told to ask for the role when the read failed.
  it("tells a missing role from a version that could not be read", () => {
    assert.equal(
      pinnedSourceNote({ status: "noRole" }),
      "Mailin iki hâlini yan yana görmek için skymail:templates:read rolü gerekiyor; değişen değişkenler yukarıda.",
    );
    assert.equal(
      pinnedSourceNote({ status: "unreadable" }),
      "Mail template'in bu isteğin bağlı olduğu sürümü okunamadı; mailin iki hâli yan yana gösterilemiyor. Değişen değişkenler yukarıda.",
    );
    assert.equal(pinnedSourceNote({ status: "loading" }), "Mailin iki hâli hazırlanıyor…");
    assert.equal(pinnedSourceNote({ status: "ready", source: FREE_SOURCE }), null);
  });
});
