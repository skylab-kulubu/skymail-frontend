/**
 * A send as skymail-backend takes it (internal/requests/mail.go, unchanged by
 * the rewrite): to a mailing list, `POST /mail_tasks {template_id,
 * mail_list_id, body_variables}`; to one person, `POST /mail_tasks/single
 * {template_id, recipient_email, recipient_full_name, body_variables}`, once
 * per person, since there is no route for a set of people. A free
 * announcement is free.basic sent the same way, its body the Visual editor's
 * render. What comes back is said plainly: which person failed and why, a
 * template refused because it was archived, a list that is gone.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../api/errors";
import { TEST_BASE_URL, json, scriptedClient } from "../api/testing";
import { buildVisual as b, visualSource } from "../mail-render/visual-document";
import type { MailTemplate } from "../templates";
import {
  FREE_TEMPLATE_KEY,
  audienceSize,
  fetchSendableLists,
  fetchSendableTemplates,
  freeTemplate,
  previewValues,
  publishedOnlyNote,
  sendPlan,
  sendRefusal,
  sendToList,
  sendToPeople,
  templateChoices,
  whyNotFound,
  type SendDraft,
} from "./send";

const LIST_ID = "3f0c1a52-7b7e-4c1d-9a55-0d6f3b2c1e10";
const TASK_ID = "b1c2d3e4-0000-4000-8000-000000000001";

function template(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    id: "7e3a1c00-0000-4000-8000-000000000001",
    name: "Etkinlik hatırlatması",
    key: null,
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
    main_mode: "jsx",
    drafts: [],
    contract_required_variables: [],
    operator_required_variables: [],
    ...overrides,
  };
}

const FREE = template({
  id: "7e3a1c00-0000-4000-8000-00000000f4ee",
  name: "Serbest Gönderim",
  key: FREE_TEMPLATE_KEY,
  subject: "{{.Subject}}",
  html_content: '{{if .Heading}}<h1>{{.Heading}}</h1>{{end}}<div>{{safeHTML .BodyHtml}}</div>{{if .CtaUrl}}<a href="{{.CtaUrl}}">{{.CtaLabel}}</a>{{end}}',
});

const BODY = visualSource(
  b.document([b.heading([b.text("Başvurular açıldı")]), b.paragraph([b.text("Son gün "), b.text("5 Nisan", [{ type: "bold" }]), b.text(".")])]),
);

const draft = (overrides: Partial<SendDraft>): SendDraft => ({
  what: "template",
  template: template(),
  fields: { values: { EventName: "GECEKODU", DetailsUrl: "https://skyl.app/gecekodu" }, rich: {} },
  audience: "list",
  list: { id: LIST_ID, name: "GECEKODU katılımcıları", external: false },
  people: [],
  ...overrides,
});

describe("a send's requests", () => {
  it("to a list: one POST /mail_tasks with the template, the list and every variable", () => {
    assert.deepEqual(sendPlan(draft({})), {
      ok: true,
      plan: {
        kind: "list",
        request: {
          template_id: "7e3a1c00-0000-4000-8000-000000000001",
          mail_list_id: LIST_ID,
          body_variables: { EventName: "GECEKODU", DetailsUrl: "https://skyl.app/gecekodu" },
        },
      },
    });
  });

  it("to people: one POST /mail_tasks/single each, with their own name and address", () => {
    const plan = sendPlan(
      draft({ audience: "people", list: null, people: [{ name: "Ayşe Yılmaz", email: "ayse@ornek.com" }, { name: "", email: "" }, { name: "Ali Can", email: " ali@ornek.com" }] }),
    );
    assert.deepEqual(plan, {
      ok: true,
      plan: {
        kind: "people",
        requests: [
          {
            template_id: "7e3a1c00-0000-4000-8000-000000000001",
            recipient_email: "ayse@ornek.com",
            recipient_full_name: "Ayşe Yılmaz",
            body_variables: { EventName: "GECEKODU", DetailsUrl: "https://skyl.app/gecekodu" },
          },
          {
            template_id: "7e3a1c00-0000-4000-8000-000000000001",
            recipient_email: "ali@ornek.com",
            recipient_full_name: "Ali Can",
            body_variables: { EventName: "GECEKODU", DetailsUrl: "https://skyl.app/gecekodu" },
          },
        ],
      },
    });
  });

  it("for a free announcement: free.basic, with the body as the markup the server keeps", () => {
    const plan = sendPlan(
      draft({
        what: "free",
        template: FREE,
        fields: { values: { Subject: "GECEKODU başvuruları açıldı", Heading: "", CtaUrl: "", CtaLabel: "" }, rich: { BodyHtml: BODY } },
      }),
    );
    assert.deepEqual(plan, {
      ok: true,
      plan: {
        kind: "list",
        request: {
          template_id: FREE.id,
          mail_list_id: LIST_ID,
          body_variables: {
            Subject: "GECEKODU başvuruları açıldı",
            Heading: "",
            BodyHtml: "<h2>Başvurular açıldı</h2><p>Son gün <strong>5 Nisan</strong>.</p>",
            CtaUrl: "",
            CtaLabel: "",
          },
        },
      },
    });
  });

  it("say what is missing instead: a template, a list, people, a field, the free announcement's body", () => {
    assert.deepEqual(sendPlan(draft({ template: null, list: null })), {
      ok: false,
      problems: { template: "Gönderilecek Mail template'i seç.", list: "Gönderilecek mail listesini seç.", people: null, fields: {} },
    });
    const free = sendPlan(draft({ what: "free", template: FREE, fields: { values: { Subject: "Duyuru" }, rich: {} } }));
    assert.deepEqual(free.ok ? null : free.problems.fields, { BodyHtml: "Gövde boş bırakılamaz." });
    const nameless = sendPlan(draft({ audience: "people", people: [{ name: "", email: "ayse@ornek.com" }] }));
    assert.deepEqual(nameless.ok ? null : nameless.problems.people, {
      people: [{ name: "", email: "ayse@ornek.com" }],
      rows: [{ name: "Bu mail alıcıyı adıyla anıyor ({{.FullName}}); adını yaz." }],
      none: false,
    });
    const nobody = sendPlan(draft({ audience: "people", people: [{ name: "", email: "" }] }));
    assert.deepEqual(nobody.ok ? null : nobody.problems.people, { people: [], rows: [{}], none: true });
    const freeWithoutTemplate = sendPlan(draft({ what: "free", template: null }));
    assert.equal(freeWithoutTemplate.ok ? null : freeWithoutTemplate.problems.template, "Serbest duyuru template'i (free.basic) SkyMail'de yok ya da arşivlenmiş; serbest duyuru gönderilemez.");
  });
});

describe("sending", () => {
  it("to a list answers with the new send's id", async () => {
    const { api, calls } = scriptedClient(json(201, { id: TASK_ID }));
    const plan = sendPlan(draft({}));
    assert.ok(plan.ok && plan.plan.kind === "list");
    assert.equal(await sendToList(api, plan.plan.request), TASK_ID);
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks`);
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(JSON.parse(calls[0].body!), plan.plan.request);
  });

  it("to people goes on past a failure and says who failed and why", async () => {
    const { api, calls } = scriptedClient(
      json(201, { id: TASK_ID }),
      json(400, { code: "validation.error", message: "One or more validation errors occurred.", params: { errors: [{ field: "recipient_email", code: "invalid_email" }] } }),
      json(201, { id: "b1c2d3e4-0000-4000-8000-000000000003" }),
    );
    const plan = sendPlan(
      draft({
        audience: "people",
        people: [
          { name: "Ayşe", email: "ayse@ornek.com" },
          { name: "Ali", email: "ali@ornek" + ".c" },
          { name: "Veli", email: "veli@ornek.com" },
        ],
      }),
    );
    assert.ok(plan.ok && plan.plan.kind === "people");
    const progress: number[] = [];
    const outcomes = await sendToPeople(api, plan.plan.requests, (done) => progress.push(done));
    assert.deepEqual(outcomes, [
      { name: "Ayşe", email: "ayse@ornek.com", ok: true, sendId: TASK_ID },
      { name: "Ali", email: "ali@ornek.c", ok: false, reason: "SkyMail bu adresi geçerli bir e-posta adresi saymadı." },
      { name: "Veli", email: "veli@ornek.com", ok: true, sendId: "b1c2d3e4-0000-4000-8000-000000000003" },
    ]);
    assert.deepEqual(progress, [1, 2, 3]);
    assert.deepEqual(
      calls.map((call) => [call.url, JSON.parse(call.body!).recipient_email]),
      [
        [`${TEST_BASE_URL}/mail_tasks/single`, "ayse@ornek.com"],
        [`${TEST_BASE_URL}/mail_tasks/single`, "ali@ornek.c"],
        [`${TEST_BASE_URL}/mail_tasks/single`, "veli@ornek.com"],
      ],
    );
  });
});

describe("a refused send, in plain words", () => {
  it("says which permission is missing", () => {
    const forbidden = new ApiError(403, "server.forbidden");
    assert.equal(sendRefusal(forbidden, "list"), "Bu hesap bir mail listesine gönderemez: skymail:mails:write rolü gerekiyor.");
    assert.equal(sendRefusal(forbidden, "person"), "Bu hesap mail gönderemez: skymail:mails:send ya da skymail:mails:write rolü gerekiyor.");
  });

  it("says a template that is gone was archived, since only a current one is sent", () => {
    assert.equal(
      sendRefusal(new ApiError(404, "server.not_found"), "person"),
      "Mail template arşivlenmiş ya da artık yok; arşivlenmiş bir template gönderilmez.",
    );
  });

  it("says an address the server refused is not one, and a server error as one", () => {
    const invalid = new ApiError(400, "validation.error", "x", { errors: [{ field: "recipient_email", code: "invalid_email" }] });
    assert.equal(sendRefusal(invalid, "person"), "SkyMail bu adresi geçerli bir e-posta adresi saymadı.");
    assert.equal(
      sendRefusal(new ApiError(500, "server.internal_server_error"), "list"),
      "Sunucuda beklenmeyen bir hata oluştu. Gönderim açılmamış olabilir: Gönderimler listesine bakıp gerekirse tekrar dene.",
    );
    assert.equal(
      sendRefusal(new ApiError(0, "network"), "person"),
      "Sunucuya ulaşılamadı; bu kişiye gidip gitmediği bilinmiyor. Gönderimler listesine bakıp gerekirse tekrar dene.",
    );
  });

  it("finds out whether the template or the list is what is gone", async () => {
    const archived = scriptedClient(json(404, { code: "server.not_found" }));
    assert.equal(
      await whyNotFound(archived.api, { templateId: "t", list: { id: LIST_ID, name: "x", external: false } }),
      "Bu Mail template arşivlenmiş; arşivlenmiş bir template gönderilmez. Başka bir template seç ya da template'i geri getir.",
    );
    const listGone = scriptedClient(json(200, template()), json(404, { code: "server.not_found" }));
    assert.equal(
      await whyNotFound(listGone.api, { templateId: "t", list: { id: LIST_ID, name: "x", external: false } }),
      "Bu liste arşivlenmiş ya da artık yok. Başka bir liste seç.",
    );
    assert.equal(listGone.calls[1].url, `${TEST_BASE_URL}/mailing_lists/${LIST_ID}`);
    const emptyGroup = scriptedClient(json(200, template()), json(200, { id: LIST_ID, name: "Grup", source: "keycloak" }));
    assert.equal(
      await whyNotFound(emptyGroup.api, { templateId: "t", list: { id: LIST_ID, name: "Grup", external: true } }),
      "Keycloak grubunda üye yok; boş bir gruba gönderim açılmaz.",
    );
  });
});

describe("what the form offers and shows", () => {
  it("reads every current template, a hundred at a time", async () => {
    const page = Array.from({ length: 100 }, (_, index) => template({ id: `t${index}`, name: `T${index}` }));
    const { api, calls } = scriptedClient(json(200, page, { "X-Total-Count": "101" }), json(200, [template({ id: "last" })], { "X-Total-Count": "101" }));
    assert.equal((await fetchSendableTemplates(api)).length, 101);
    assert.deepEqual(
      calls.map((call) => new URL(call.url).search),
      ["?lifecycle=current&_start=0&_end=100", "?lifecycle=current&_start=100&_end=200"],
    );
  });

  it("offers templates by name, free.basic apart: it is the free announcement", () => {
    const choices = templateChoices([template({ id: "b", name: "Zeytin" }), FREE, template({ id: "a", name: "Çay" }), template({ id: "c", name: "Armut" })]);
    assert.deepEqual(choices.map((choice) => choice.name), ["Armut", "Çay", "Zeytin"]);
    assert.equal(freeTemplate([template(), FREE])?.id, FREE.id);
    assert.equal(freeTemplate([template()]), null);
  });

  it("reads every current list and group once, internal lists first", async () => {
    const internal = (id: string) => ({ id, name: id, description: null, created_at: "", updated_at: "", source: "internal" });
    const group = { id: "g1", name: "WEBLAB", description: "/UYELER/ARGE/WEBLAB", created_at: "", updated_at: "", source: "keycloak" };
    const { api } = scriptedClient(json(200, [internal("a"), internal("b"), group], { "X-Total-Count": "3" }));
    assert.deepEqual(
      (await fetchSendableLists(api)).map((row) => [row.id, row.external]),
      [
        ["a", false],
        ["b", false],
        ["g1", true],
      ],
    );
  });

  it("counts a list's recipients, and a group's members", async () => {
    const { api, calls } = scriptedClient(json(200, [{ id: "r1" }], { "X-Total-Count": "248" }));
    assert.equal(await audienceSize(api, { id: LIST_ID, external: false }), 248);
    assert.match(calls[0].url, /\/mailing_lists\/3f0c1a52-7b7e-4c1d-9a55-0d6f3b2c1e10\/recipients\?_start=0&_end=/);
    const group = scriptedClient(json(200, [{ id: "m1" }, { id: "m2" }]));
    assert.equal(await audienceSize(group.api, { id: LIST_ID, external: true }), 2);
  });

  it("says what is sent when a template has a draft open: the published version", () => {
    assert.equal(publishedOnlyNote(template()), null);
    const drafted = template({
      drafts: [
        {
          id: "d1",
          template_id: "t",
          seq: 4,
          subject: "",
          requested_subject: null,
          main_mode: "visual",
          author: { kind: "operator", sub: "s", name: "Mehmet Kaya" },
          created_at: "",
          published_at: null,
          base_version_id: null,
          current: false,
          discarded: false,
        },
      ],
    });
    assert.equal(publishedOnlyNote(drafted), "Bu template'te yayımlanmamış bir taslak var (Mehmet Kaya). Gönderilen: yayımlanmış sürüm.");
  });

  it("previews with what will be sent: the body as the server keeps it, and a recipient; an empty field shows where it goes", () => {
    const values = previewValues(
      { Subject: "Duyuru", Heading: "", BodyHtml: '<p><a href="https://skyl.app/x">x</a></p>' },
      { name: "Ayşe Yılmaz", email: "ayse@ornek.com" },
      ["BodyHtml"],
    );
    assert.deepEqual(values, {
      Subject: "Duyuru",
      BodyHtml: '<p><a href="https://skyl.app/x" target="_blank" rel="noopener">x</a></p>',
      FullName: "Ayşe Yılmaz",
      Email: "ayse@ornek.com",
    });
    assert.deepEqual(previewValues({}, null, []), { FullName: "Ayşe Yılmaz", Email: "ayse.yilmaz@example.com" });
  });
});
