/**
 * The editor's requests, driven through the one HTTP client against scripted
 * answers shaped like skymail-backend's draft and version routes (tickets 04,
 * 07, 08): which request goes out, and what the editor makes of the answer —
 * a publish that lands, a stale draft, a refused save.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEST_BASE_URL, json, scriptedClient, type RecordedCall } from "../api/testing";
import {
  createTemplate,
  discardDraft,
  fetchTemplate,
  fetchVersion,
  publishDraft,
  saveDraft,
  versionProblem,
} from "./api";

const pathOf = (call: RecordedCall) => call.url.slice(TEST_BASE_URL.length);
const bodyOf = (call: RecordedCall) => (call.body === null ? null : JSON.parse(call.body));

const TEMPLATE = "7e3a1c00-0000-4000-8000-000000000001";
const DRAFT = "9a1b2c00-0000-4000-8000-000000000007";
const BASE = "9a1b2c00-0000-4000-8000-000000000003";
const NEWER = "9a1b2c00-0000-4000-8000-000000000005";

const stale = (published: string) =>
  json(409, {
    code: "template.stale_base",
    message: "A newer version was published after this draft was started.",
    params: { version_id: DRAFT, base_version_id: BASE, published_version_id: published },
  });

describe("reading a template and a version", () => {
  it("asks the template and version routes", async () => {
    const { api, calls } = scriptedClient(json(200, { id: TEMPLATE }), json(200, { id: DRAFT }));
    await fetchTemplate(api, TEMPLATE);
    await fetchVersion(api, TEMPLATE, DRAFT);
    assert.deepEqual(calls.map(pathOf), [`/templates/${TEMPLATE}`, `/templates/${TEMPLATE}/versions/${DRAFT}`]);
  });
});

describe("creating a template", () => {
  it("posts it to the template routes, which publish its first version", async () => {
    const { api, calls } = scriptedClient(json(201, { id: TEMPLATE }));
    const body = { name: "Duyuru", subject: "Merhaba", html_content: "<p/>", plain_text_content: "x", react_email_content: "// x\n" };
    assert.equal((await createTemplate(api, body)).id, TEMPLATE);
    assert.equal(pathOf(calls[0]), "/templates");
    assert.deepEqual(bodyOf(calls[0]), body);
  });
});

describe("saving a draft", () => {
  it("posts the draft to the template's drafts", async () => {
    const { api, calls } = scriptedClient(json(201, { id: DRAFT, published_at: null }));
    const body = {
      subject: "Merhaba",
      main_mode: "html" as const,
      html_source: "<p>x</p>",
      html_content: "<p>x</p>",
      plain_text_content: "x",
      base_version_id: BASE,
    };
    const saved = await saveDraft(api, TEMPLATE, body);
    assert.equal(saved.id, DRAFT);
    assert.equal(calls[0].method, "POST");
    assert.equal(pathOf(calls[0]), `/templates/${TEMPLATE}/drafts`);
    assert.deepEqual(bodyOf(calls[0]), body);
  });
});

describe("publishing a draft", () => {
  it("publishes it as it is, with no body", async () => {
    const { api, calls } = scriptedClient(json(200, { id: TEMPLATE, published_version_id: DRAFT }));
    const outcome = await publishDraft(api, TEMPLATE, DRAFT);
    assert.deepEqual(outcome, { kind: "published", template: { id: TEMPLATE, published_version_id: DRAFT } });
    assert.equal(pathOf(calls[0]), `/templates/${TEMPLATE}/versions/${DRAFT}/publish`);
    assert.equal(calls[0].body, null);
  });

  it("comes back stale, naming the draft and what is published now, when someone published since it started", async () => {
    const { api } = scriptedClient(stale(NEWER));
    assert.deepEqual(await publishDraft(api, TEMPLATE, DRAFT), {
      kind: "stale",
      conflict: { draftId: DRAFT, baseVersionId: BASE, publishedVersionId: NEWER },
    });
  });

  it("over a stale base names the version the operator saw and chose to replace", async () => {
    const { api, calls } = scriptedClient(json(200, { id: TEMPLATE }));
    await publishDraft(api, TEMPLATE, DRAFT, NEWER);
    assert.deepEqual(bodyOf(calls[0]), { force: { over_version_id: NEWER } });
  });

  it("comes back stale again when yet another version was published before the confirmation", async () => {
    const latest = "9a1b2c00-0000-4000-8000-000000000009";
    const { api } = scriptedClient(stale(latest));
    const outcome = await publishDraft(api, TEMPLATE, DRAFT, NEWER);
    assert.equal(outcome.kind === "stale" && outcome.conflict.publishedVersionId, latest);
  });

  it("throws any other refusal", async () => {
    const { api } = scriptedClient(json(409, { code: "template.draft_discarded", message: "discarded" }));
    await assert.rejects(publishDraft(api, TEMPLATE, DRAFT), { code: "template.draft_discarded" });
  });
});

describe("discarding a draft", () => {
  it("posts to the draft's discard", async () => {
    const { api, calls } = scriptedClient(json(200, { id: DRAFT, discarded: true }));
    await discardDraft(api, TEMPLATE, DRAFT);
    assert.equal(pathOf(calls[0]), `/templates/${TEMPLATE}/versions/${DRAFT}/discard`);
  });
});

describe("what a refused save or publish says", () => {
  const refused = async (status: number, body: unknown) => {
    const { api } = scriptedClient(json(status, body));
    return saveDraft(api, TEMPLATE, {
      subject: "x",
      main_mode: "html",
      html_content: "x",
      plain_text_content: "x",
      base_version_id: BASE,
    }).catch((error: unknown) => error);
  };

  it("names each Required variable the body dropped, and why the mail needs it", async () => {
    const error = await refused(422, {
      code: "template.required_variables_missing",
      message: "The HTML body does not reference every Required variable of the template.",
      params: {
        missing: [
          { name: "firstName", source: "operator", reason: null },
          { name: "link", source: "contract", reason: "Parola sıfırlama bağlantısı; kaldırılırsa mail işe yaramaz." },
        ],
      },
    });
    assert.deepEqual(versionProblem(error), {
      kind: "missing-variables",
      message: "Gövde, bu template'in Required variable'larından bazılarına artık başvurmuyor.",
      missing: [
        { name: "firstName", source: "operator", why: "Bir operatör bu değişkeni zorunlu işaretledi." },
        { name: "link", source: "contract", why: "Parola sıfırlama bağlantısı; kaldırılırsa mail işe yaramaz." },
      ],
    });
  });

  it("gives a contract variable with no reason the contract as its reason", async () => {
    const error = await refused(422, {
      code: "template.required_variables_missing",
      params: { missing: [{ name: "code", source: "contract", reason: null }] },
    });
    const problem = versionProblem(error);
    assert.equal(problem.kind === "missing-variables" && problem.missing[0].why, "Gönderen servisin sözleşmesi bu değişkeni istiyor.");
  });

  it("names the part the mailer could not parse, with the parser's words", async () => {
    const error = await refused(422, {
      code: "template.unparseable",
      params: { part: "subject", error: 'template: subject:1: unexpected "}" in operand' },
    });
    assert.deepEqual(versionProblem(error), {
      kind: "unparseable",
      message: "Konu, mailer'ın okuyabileceği bir Go template değil.",
      detail: 'template: subject:1: unexpected "}" in operand',
    });
  });

  it("does not take an unknown part for one it knows", async () => {
    const problem = versionProblem(await refused(422, { code: "template.unparseable", params: { part: "constructor", error: "x" } }));
    assert.equal(problem.message, "Konu ya da gövde, mailer'ın okuyabileceği bir Go template değil.");
  });

  it("is the API error's sentence for anything else", async () => {
    const error = await refused(404, { code: "server.not_found" });
    assert.deepEqual(versionProblem(error), {
      kind: "message",
      message: "Aradığın kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir.",
    });
    assert.deepEqual(versionProblem(new TypeError("Failed to fetch")), {
      kind: "message",
      message: "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.",
    });
  });

  it("does not trust a refusal whose details are not the documented shape", async () => {
    const error = await refused(422, {
      code: "template.required_variables_missing",
      params: { missing: [{ name: 5 }, "link", null] },
    });
    assert.deepEqual(versionProblem(error), {
      kind: "missing-variables",
      message: "Gövde, bu template'in Required variable'larından bazılarına artık başvurmuyor.",
      missing: [],
    });
  });
});
