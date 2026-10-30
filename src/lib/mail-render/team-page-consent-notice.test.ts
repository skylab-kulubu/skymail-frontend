/**
 * core.team-page-consent-notice (ekip-yetki-devri 21, core-backend
 * docs/team-page-consent.md): the one notice core's `team-page-notice -apply`
 * sends when the team page consent's transition starts. core posts it by key
 * with FirstName, Teams, HideAt, SettingsURL and Board; Board is "true" only
 * for a person the Board's own roster keeps by name without the consent.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

const KEY = "core.team-page-consent-notice";
const CORE_VARIABLES = ["Board", "FirstName", "HideAt", "SettingsURL", "Teams"];

async function rendered() {
  const template = findTemplate(KEY);
  assert.ok(template, KEY);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${KEY} does not render`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").replace(/ ([,.])/g, "$1");

/** The mail as a person reads it with these values over the sample. */
async function received(vars: Record<string, unknown>) {
  const { meta, html, plainText } = await rendered();
  const all = { ...meta.sample, ...vars };
  return {
    subject: fillSampleValues(meta.subject, all, { as: "text" }),
    html: text(fillSampleValues(html, all)),
    plainText: fillSampleValues(plainText, all, { as: "text" }),
  };
}

describe("the team page consent notice", () => {
  it("is a System template reading exactly what core sends", async () => {
    const { meta, html } = await rendered();
    assert.equal(meta.system, true);
    assert.equal(meta.contentSensitive, false);
    assert.equal(meta.subject, "Ekip sayfalarında görünürlüğün");
    assert.deepEqual([...meta.variables].sort(), CORE_VARIABLES);
    assert.deepEqual(Object.keys(meta.sample).sort(), CORE_VARIABLES);
    assert.deepEqual((meta.requiredVariables ?? []).map(({ name }) => name), ["HideAt", "SettingsURL"]);
    assert.equal(meta.sensitiveVariables, undefined);
    const referenced = [...referencedVariables(html)].filter((name) => name !== "UnsubscribeUrl");
    assert.deepEqual(referenced.sort(), CORE_VARIABLES);
  });

  it("names the teams, the time and the setting, and links the setting", async () => {
    const mail = await received({ Teams: "WEBLAB · Web Geliştirme, AGC", HideAt: "11.11.2026 00:00" });
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /Merhaba Yusuf,/);
      assert.match(body, /SKY LAB uygulamasındaki şu ekip sayfalarında görünüyor/);
      // The site reads no core roster: the mail promises nothing about it.
      assert.doesNotMatch(body, /site/i);
      assert.match(body, /WEBLAB · Web Geliştirme, AGC/);
      assert.match(body, /11\.11\.2026 00:00 itibarıyla bu sayfalarda yalnız izin veren üyeler görünecek\./);
      assert.match(body, /İzin vermezsen bu sayfalardan kaldırılırsın\./);
      assert.match(body, /https:\/\/my\.yildizskylab\.com\/club-profile/);
      assert.doesNotMatch(body, /Yönetim Kurulu/);
    }
  });

  it("tells a Board member that the Board's page keeps their name only", async () => {
    const mail = await received({ Board: "true", Teams: "YK · Yönetim Kurulu" });
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /uygulamadaki Yönetim Kurulu sayfasında adın ve soyadın görünmeye devam eder/);
      assert.match(body, /fotoğrafın ve diğer bilgilerin yalnız izin verirsen görünür/);
      assert.doesNotMatch(body, /İzin vermezsen bu sayfalardan kaldırılırsın/);
      assert.doesNotMatch(body, /site/i);
    }
  });

  it("greets nobody by name when core has no first name", async () => {
    const mail = await received({ FirstName: "" });
    assert.doesNotMatch(mail.html, /Merhaba/);
    assert.match(mail.html, /Adın ve profil bilgilerin/);
  });
});
