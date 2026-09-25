/**
 * What the editor says when the API refuses a save, a Main source change or
 * a publish (tickets 07 and 08), from the refusal's documented params.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { json, scriptedClient } from "../api/testing";
import { saveDraft } from "../templates";
import { versionProblem } from "./refusals";

const TEMPLATE = "7e3a1c00-0000-4000-8000-000000000001";
const BASE = "9a1b2c00-0000-4000-8000-000000000003";

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
