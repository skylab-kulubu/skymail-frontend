/**
 * A send as skymail-backend takes it (internal/requests/mail.go, unchanged by
 * the rewrite): to a mailing list, `POST /mail_tasks {template_id,
 * mail_list_id, body_variables}`; to one person, `POST /mail_tasks/single
 * {template_id, recipient_email, recipient_full_name, body_variables}`, once
 * per person, since there is no route for a set of people. A free
 * announcement is free.basic sent the same way, its body the Visual editor's
 * render.
 *
 * What comes back is said plainly, and never sends a mail twice by accident:
 * a refusal (403, 404, 400, 422) is final and not offered again; a request
 * the server never took (401, 429) may be tried again; a server error or no
 * answer at all means the send may already be open, so it is said so and a
 * re-send has to be confirmed as a possible duplicate.
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
  mergeOutcomes,
  previewValues,
  publishedOnlyNote,
  repeatsUncertainSend,
  retryOf,
  sendFailure,
  sendPlan,
  sendToList,
  sendToPeople,
  templateChoices,
  whyNotFound,
  type PersonOutcome,
  type SendDraft,
  type SingleSendRequest,
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
      warnings: { fields: {}, people: [], lines: [] },
    });
  });

  it("to people: one POST /mail_tasks/single each, with their own name and address", () => {
    const plan = sendPlan(
      draft({ audience: "people", list: null, people: [{ name: "Ayşe Yılmaz", email: "ayse@ornek.com" }, { name: "", email: "" }, { name: "Ali Can", email: " ali@ornek.com" }] }),
    );
    assert.ok(plan.ok);
    assert.deepEqual(plan.plan, {
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
    assert.ok(plan.ok);
    assert.deepEqual(plan.plan, {
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
    });
  });

  it("say what keeps them from going: no template, no list, an empty Required variable, an address that is not one", () => {
    assert.deepEqual(sendPlan(draft({ template: null, list: null })), {
      ok: false,
      problems: { template: "Gönderilecek Mail template'i seç.", list: "Gönderilecek mail listesini seç.", people: null, fields: {} },
      warnings: { fields: {}, people: [], lines: [] },
    });
    const required = sendPlan(draft({ template: template({ contract_required_variables: [{ name: "DetailsUrl", reason: "Etkinliğin sayfası." }] }), fields: { values: { EventName: "x" }, rich: {} } }));
    assert.deepEqual(required.ok ? null : required.problems.fields, { DetailsUrl: "DetailsUrl boş bırakılamaz: bir Required variable." });
    const nobody = sendPlan(draft({ audience: "people", people: [{ name: "Ayşe", email: "ayse@" }] }));
    assert.deepEqual(nobody.ok ? null : nobody.problems.people?.rows, [{ email: "Geçerli bir e-posta adresi gir." }]);
    const freeWithoutTemplate = sendPlan(draft({ what: "free", template: null }));
    assert.equal(freeWithoutTemplate.ok ? null : freeWithoutTemplate.problems.template, "Serbest duyuru template'i (free.basic) SkyMail'de yok ya da arşivlenmiş; serbest duyuru gönderilemez.");
  });

  it("go with what may be a slip said, as the old form let them: an empty subject field, an empty announcement, a nameless person", () => {
    const free = sendPlan(draft({ what: "free", template: FREE, fields: { values: {}, rich: {} } }));
    assert.ok(free.ok);
    assert.deepEqual(free.warnings.lines, ["Konu: Konuda geçiyor: boş giderse konu eksik görünür.", "Gövde: Gövde boş: duyuru metinsiz gider."]);
    const nameless = sendPlan(draft({ audience: "people", people: [{ name: "", email: "ayse@ornek.com" }] }));
    assert.ok(nameless.ok);
    assert.deepEqual(nameless.warnings.people, ["Bu mail alıcıyı adıyla anıyor ({{.FullName}}); adı boş giderse selamlama eksik kalır."]);
    assert.deepEqual(nameless.warnings.lines, ["1. kişi (ayse@ornek.com): Bu mail alıcıyı adıyla anıyor ({{.FullName}}); adı boş giderse selamlama eksik kalır."]);
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

  it("to people goes on past a failure, and tells a refusal from a send that may have opened", async () => {
    const { api, calls } = scriptedClient(
      json(201, { id: TASK_ID }),
      json(400, { code: "validation.error", message: "x", params: { errors: [{ field: "recipient_email", code: "invalid_email" }] } }),
      json(500, { code: "server.internal_server_error", message: "boom" }),
      json(201, { id: "b1c2d3e4-0000-4000-8000-000000000004" }),
    );
    const progress: number[] = [];
    const outcomes = await sendToPeople(api, REQUESTS, { canSeeSends: true, onEach: (done) => progress.push(done) });
    assert.deepEqual(outcomes, [
      { name: "Ayşe", email: "ayse@ornek.com", status: "sent", sendId: TASK_ID },
      { name: "Ali", email: "ali@ornek.c", status: "final", reason: "SkyMail bu adresi geçerli bir e-posta adresi saymadı." },
      {
        name: "Veli",
        email: "veli@ornek.com",
        status: "uncertain",
        reason:
          "Sunucu bir hatayla yanıt verdi (HTTP 500). Bu kişiye gönderim açılmış olabilir. Yeniden göndermeden önce Gönderimler listesine bak: orada görünüyorsa açılmıştır.",
      },
      { name: "Zeynep", email: "zeynep@ornek.com", status: "sent", sendId: "b1c2d3e4-0000-4000-8000-000000000004" },
    ]);
    assert.deepEqual(progress, [1, 2, 3, 4]);
    assert.deepEqual(
      calls.map((call) => JSON.parse(call.body!).recipient_email),
      ["ayse@ornek.com", "ali@ornek.c", "veli@ornek.com", "zeynep@ornek.com"],
    );
  });
});

const REQUESTS: SingleSendRequest[] = [
  ["Ayşe", "ayse@ornek.com"],
  ["Ali", "ali@ornek.c"],
  ["Veli", "veli@ornek.com"],
  ["Zeynep", "zeynep@ornek.com"],
].map(([name, email]) => ({ template_id: "t", recipient_email: email, recipient_full_name: name, body_variables: {} }));

describe("a failed send, in plain words", () => {
  const person = { canSeeSends: true };

  it("is final when refused: a missing role, an archived template, an address that is not one, a body the server refused", () => {
    assert.deepEqual(sendFailure(new ApiError(403, "server.forbidden"), "list", person), {
      kind: "final",
      reason: "Bu hesap bir mail listesine gönderemez: skymail:mails:write rolü gerekiyor.",
    });
    assert.deepEqual(sendFailure(new ApiError(403, "server.forbidden"), "person", person), {
      kind: "final",
      reason: "Bu hesap mail gönderemez: skymail:mails:send ya da skymail:mails:write rolü gerekiyor.",
    });
    assert.deepEqual(sendFailure(new ApiError(404, "server.not_found"), "person", person), {
      kind: "final",
      reason: "Mail template arşivlenmiş ya da artık yok; arşivlenmiş bir template gönderilmez.",
    });
    const invalid = new ApiError(400, "validation.error", "x", { errors: [{ field: "recipient_email", code: "invalid_email" }] });
    assert.deepEqual(sendFailure(invalid, "person", person), { kind: "final", reason: "SkyMail bu adresi geçerli bir e-posta adresi saymadı." });
    assert.deepEqual(sendFailure(new ApiError(422, "template.unparseable"), "list", person), {
      kind: "final",
      reason: "SkyMail gönderimi reddetti: Konu ya da gövde, mailer'ın okuyabileceği bir Go template değil.",
    });
  });

  it("may be tried again when the server never took it: an ended session, too many requests", () => {
    assert.deepEqual(sendFailure(new ApiError(401, "server.unauthorized"), "person", person), {
      kind: "notSent",
      reason: "Oturumun sona erdi; gönderim açılmadı. Yeniden giriş yapınca tekrar deneyebilirsin.",
    });
    assert.deepEqual(sendFailure(new ApiError(429, "server.too_many_requests"), "list", person), {
      kind: "notSent",
      reason: "Kısa sürede çok fazla istek gönderildi; gönderim açılmadı. Biraz bekleyip tekrar dene.",
    });
  });

  it("may have opened on a server error or no answer, and says how to find out, for who can see the sends and who cannot", () => {
    assert.deepEqual(sendFailure(new ApiError(0, "network"), "list", person), {
      kind: "uncertain",
      reason: "Sunucudan yanıt gelmedi. Gönderim açılmış olabilir. Yeniden göndermeden önce Gönderimler listesine bak: orada görünüyorsa açılmıştır.",
    });
    assert.deepEqual(sendFailure(new ApiError(503, "server.service_unavailable"), "person", { canSeeSends: false }), {
      kind: "uncertain",
      reason:
        "Sunucu bir hatayla yanıt verdi (HTTP 503). Bu kişiye gönderim açılmış olabilir. Gönderimleri görme yetkin (skymail:mails:read) yok: yeniden göndermeden önce bu yetkisi olan birine gönderimin açılıp açılmadığını sor.",
    });
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

describe("trying again", () => {
  const outcome = (email: string, status: PersonOutcome["status"]): PersonOutcome =>
    status === "sent" ? { name: email, email, status, sendId: `id-${email}` } : { name: email, email, status, reason: status };
  const requests = REQUESTS.map((request) => ({ ...request, recipient_full_name: request.recipient_email }));
  const outcomes = [
    outcome("ayse@ornek.com", "sent"),
    outcome("ali@ornek.c", "final"),
    outcome("veli@ornek.com", "uncertain"),
    outcome("zeynep@ornek.com", "notSent"),
  ];

  it("offers only who has not got it for sure, never a refusal, and names who may get it twice", () => {
    const retry = retryOf(requests, outcomes);
    assert.deepEqual(
      retry.requests.map((request) => request.recipient_email),
      ["veli@ornek.com", "zeynep@ornek.com"],
    );
    assert.deepEqual(retry.uncertain, [{ name: "veli@ornek.com", email: "veli@ornek.com" }]);
    assert.deepEqual(retry.notSent, [{ name: "zeynep@ornek.com", email: "zeynep@ornek.com" }]);
    assert.deepEqual(retryOf(requests, [outcomes[0], outcomes[1]]).requests, []);
  });

  it("puts each person's new outcome in place of the old one", () => {
    const again = [outcome("veli@ornek.com", "sent"), outcome("zeynep@ornek.com", "uncertain")];
    assert.deepEqual(mergeOutcomes(outcomes, again), [outcomes[0], outcomes[1], again[0], again[1]]);
  });

  it("holds back a list send that may already be open: the same template to the same list", () => {
    const uncertain = { templateId: "7e3a1c00-0000-4000-8000-000000000001", listId: LIST_ID, listName: "GECEKODU katılımcıları" };
    assert.equal(repeatsUncertainSend(draft({}), uncertain), true);
    assert.equal(repeatsUncertainSend(draft({}), null), false);
    assert.equal(repeatsUncertainSend(draft({ list: { id: "other", name: "Başka", external: false } }), uncertain), false);
    assert.equal(repeatsUncertainSend(draft({ template: template({ id: "other" }) }), uncertain), false);
    assert.equal(repeatsUncertainSend(draft({ audience: "people" }), uncertain), false);
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

  it("previews exactly what will be sent: an empty field as nothing, and a recipient", () => {
    const values = previewValues({ Subject: "Duyuru", Heading: "", BodyHtml: '<p><a href="https://skyl.app/x">x</a></p>' }, {
      name: "Ayşe Yılmaz",
      email: "ayse@ornek.com",
    });
    assert.deepEqual(values, {
      Subject: "Duyuru",
      Heading: "",
      BodyHtml: '<p><a href="https://skyl.app/x">x</a></p>',
      FullName: "Ayşe Yılmaz",
      Email: "ayse@ornek.com",
    });
    assert.deepEqual(previewValues({}, null), { FullName: "Ayşe Yılmaz", Email: "ayse.yilmaz@example.com" });
  });
});
