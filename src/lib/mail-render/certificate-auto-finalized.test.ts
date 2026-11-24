/**
 * core.certificate-auto-finalized (sertifika-oturum 09, core-backend
 * internal/certificate/auto_finalize.go): the mail core sends the person who
 * published an Event when its attendance closed by itself. core posts it by
 * key with FirstName, EventName, EventId, CertificateCount and OwnerTeam;
 * CertificateCount may be "0".
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

const KEY = "core.certificate-auto-finalized";
const CORE_VARIABLES = ["CertificateCount", "EventId", "EventName", "FirstName", "OwnerTeam"];

async function rendered() {
  const template = findTemplate(KEY);
  assert.ok(template, KEY);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${KEY} does not render`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").replace(/ ([,.])/g, "$1");

async function received(vars: Record<string, unknown>) {
  const { meta, html, plainText } = await rendered();
  const all = { ...meta.sample, ...vars };
  return {
    subject: fillSampleValues(meta.subject, all, { as: "text" }),
    rawHtml: fillSampleValues(html, all),
    html: text(fillSampleValues(html, all)),
    plainText: fillSampleValues(plainText, all, { as: "text" }),
  };
}

describe("the attendance auto-finalized mail", () => {
  it("is a System template reading exactly what core sends", async () => {
    const { meta, html } = await rendered();
    assert.equal(meta.system, true);
    assert.equal(meta.contentSensitive, false);
    assert.equal(meta.subject, "{{.EventName}}: katılım kapandı");
    assert.deepEqual([...meta.variables].sort(), CORE_VARIABLES);
    assert.deepEqual(Object.keys(meta.sample).sort(), CORE_VARIABLES);
    assert.deepEqual((meta.requiredVariables ?? []).map(({ name }) => name), ["EventId"]);
    assert.equal(meta.notification, undefined);
    const referenced = [...referencedVariables(html)].filter((name) => name !== "UnsubscribeUrl");
    assert.deepEqual(referenced.sort(), CORE_VARIABLES);
  });

  it("names the Event and the count and links the panel's certificates tab", async () => {
    const mail = await received({ EventName: "ARTLAB 2026", CertificateCount: "42", EventId: "e1" });
    assert.equal(mail.subject, "ARTLAB 2026: katılım kapandı");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /Merhaba Yusuf,/);
      assert.match(body, /ARTLAB 2026/);
      assert.match(body, /kendiliğinden kapandı/);
      assert.match(body, /42\s+kişinin sertifikası sıraya alındı/);
      assert.match(body, /Uygunları yeniden tara/);
      assert.match(body, /https:\/\/admin\.yildizskylab\.com\/events\/e1\/certificates/);
      assert.doesNotMatch(body, /Sıraya alınan sertifika yok/);
    }
  });

  it("says nothing was queued when the count is zero", async () => {
    const mail = await received({ CertificateCount: "0" });
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /Sıraya alınan sertifika yok\./);
      assert.doesNotMatch(body, /kişinin sertifikası/);
    }
  });

  it("leaves out the greeting and the organizer row when core has none", async () => {
    const mail = await received({ FirstName: "", OwnerTeam: "" });
    assert.doesNotMatch(mail.html, /Merhaba/);
    assert.doesNotMatch(mail.html, /Düzenleyen/);
  });
});
