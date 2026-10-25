/**
 * core.contact-consent-confirm (ADR-0062, core-backend docs/contact-consents.md):
 * the double opt-in mail core sends for a pending contact consent. core posts
 * it by key with exactly confirmUrl, withdrawUrl and purpose
 * (internal/consent/service.go sendConfirmation) and no name: whoever typed
 * the address may have typed any name with it. purpose is event_invitations or
 * promotional (recruitment_pool once it is taken), so the text branches on it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

const KEY = "core.contact-consent-confirm";
const CORE_VARIABLES = ["confirmUrl", "purpose", "withdrawUrl"];

async function rendered() {
  const template = findTemplate(KEY);
  assert.ok(template, KEY);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${KEY} does not render`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/\s+/g, " ");

/** The mail as a person reads it for one purpose: the preview filler picks the branch core's purpose selects. */
async function receivedFor(purpose: string) {
  const { meta, html, plainText } = await rendered();
  const vars = { ...meta.sample, purpose };
  return {
    subject: fillSampleValues(meta.subject, vars, { as: "text" }),
    html: text(fillSampleValues(html, vars)),
    plainText: fillSampleValues(plainText, vars, { as: "text" }),
  };
}

describe("the contact consent confirmation mail", () => {
  it("is a sensitive System template reading exactly what core sends", async () => {
    const { meta, html } = await rendered();
    assert.equal(meta.system, true);
    assert.equal(meta.contentSensitive, true);
    assert.equal(meta.brand, "skylab");
    assert.deepEqual([...meta.variables].sort(), CORE_VARIABLES);
    assert.deepEqual(Object.keys(meta.sample).sort(), CORE_VARIABLES);
    assert.deepEqual((meta.requiredVariables ?? []).map(({ name }) => name), ["confirmUrl"]);
    assert.deepEqual(meta.sensitiveVariables, ["confirmUrl", "withdrawUrl"]);
    // Beside the footer's unsubscribe link, which the mailer fills.
    const referenced = [...referencedVariables(html)].filter((name) => name !== "UnsubscribeUrl");
    assert.deepEqual(referenced.sort(), CORE_VARIABLES);
  });

  it("greets nobody and names no person", async () => {
    const { meta, html, plainText } = await rendered();
    for (const body of [html, plainText, meta.subject]) {
      assert.ok(!body.includes("Merhaba"), "greets");
      assert.ok(!/\{\{[^}]*\.(FirstName|firstName|FullName|Email)\b/.test(body), "reads a name or the address");
    }
  });

  it("links the confirm button and the withdraw link in both bodies", async () => {
    const { html, plainText } = await rendered();
    assert.match(html, /href="\{\{\.confirmUrl\}\}"/);
    assert.match(html, /href="\{\{\.withdrawUrl\}\}"/);
    assert.ok(plainText.includes("{{.confirmUrl}}") && plainText.includes("{{.withdrawUrl}}"));
    assert.match(html, /href="https:\/\/yildizskylab\.com\/acik-riza-metni\.pdf"/);
  });

  it("says what the consent is for, per purpose", async () => {
    const invitations = await receivedFor("event_invitations");
    assert.equal(invitations.subject, "SKY LAB duyuru iznini onayla");
    const promotional = await receivedFor("promotional");
    assert.equal(promotional.subject, "SKY LAB tanıtım e-postası iznini onayla");
    const other = await receivedFor("recruitment_pool");
    assert.equal(other.subject, "SKY LAB iznini onayla");

    for (const body of [invitations.html, invitations.plainText]) {
      assert.ok(body.includes("diğer SKY LAB etkinlikleri ve duyurularıyla ilgili e-postalar"), body);
      assert.ok(!body.includes("tanıtım"), "the invitations mail speaks of promotion");
    }
    for (const body of [promotional.html, promotional.plainText]) {
      assert.ok(body.includes("tanıtım içerikli SKY LAB e-postaları (indirim kodu, şirket iş ilanı, çekiliş gibi)"), body);
      assert.ok(!body.includes("duyurularıyla"), "the promotional mail speaks of announcements");
    }
    for (const body of [other.html, other.plainText]) {
      assert.ok(!body.includes("duyurularıyla") && !body.includes("tanıtım içerikli"), body);
    }
  });

  it("says nothing is sent until confirmed, how long the link works, and what to do if it was not you", async () => {
    for (const purpose of ["event_invitations", "promotional"]) {
      const { html } = await receivedFor(purpose);
      const count = (phrase: string) => html.split(phrase).length - 1;
      assert.equal(count("Onaylayana kadar bu adrese gönderilmez."), 1, purpose);
      // core's PendingTTL: the confirm link of a pending grant expires 30 days after the mail.
      assert.equal(count("Bu bağlantı 30 gün geçerli."), 1, purpose);
      assert.equal(count("Bu isteği sen yapmadıysan bu e-postayı yok say"), 1, purpose);
    }
  });

  it("carries no sponsor or other commercial content (ADR-0062)", async () => {
    const { meta, html } = await rendered();
    const body = text(fillSampleValues(html, meta.sample));
    for (const word of ["sponsor", "Sponsor", "katkılarıyla", "indirim kodu SKY", "kampanya"]) {
      assert.ok(!body.includes(word), word);
    }
  });
});
