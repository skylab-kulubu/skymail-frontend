/**
 * The Login code mail and its operator alarm, sent by Keycloak's SkyMail provider (e-skylab-keycloak,
 * sky-email-code, eskylab-login-ux 08, ADR-0063). Keycloak passes every one of its system-mail
 * variables on every mail, empty when it does not know one (docs/keycloak-mail-via-skymail.md);
 * the Login code fills code, codeExpirationMinutes and purpose.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

/** What Keycloak's SkyMail provider always passes (SkyMailMessage.VARIABLE_NAMES), beside Email and FullName. */
const KEYCLOAK_SENDS = [
  "link",
  "linkExpirationMinutes",
  "code",
  "codeExpirationMinutes",
  "purpose",
  "firstName",
  "username",
  "realmDisplayName",
  "subjectKey",
];

async function rendered(key: string) {
  const template = findTemplate(key);
  assert.ok(template, `${key} is not in emails/index.ts`);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${key} does not render`);
  return { meta: template.meta, html: result.html };
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/\s+/g, " ");

const loginSample = {
  code: "731904",
  codeExpirationMinutes: "10",
  purpose: "login",
  firstName: "Ada",
  username: "ada",
  realmDisplayName: "SKY LAB",
  subjectKey: "skyLoginCodeSubject",
  link: "",
  linkExpirationMinutes: "",
};

describe("the Login code mail", () => {
  it("is a masked system template that reads only what Keycloak sends", async () => {
    const { meta, html } = await rendered("keycloak.login-code");
    assert.equal(meta.system, true);
    assert.equal(meta.contentSensitive, true);
    assert.deepEqual(meta.sensitiveVariables, ["code"]);
    assert.deepEqual((meta.requiredVariables ?? []).map(({ name }) => name), ["code"]);
    for (const name of meta.variables) {
      assert.ok(KEYCLOAK_SENDS.includes(name), `${name} is not something Keycloak sends`);
    }
    const referenced = [...referencedVariables(html)].filter((name) => name !== "Email" && name !== "FullName");
    for (const name of referenced) {
      assert.ok(meta.variables.includes(name), `the body reads ${name}, which the template does not declare`);
    }
    assert.ok(referenced.includes("code"));
  });

  // CONTEXT "Login code": no magic link, never the code in the subject line.
  it("carries no link and keeps the code out of the subject", async () => {
    const { meta, html } = await rendered("keycloak.login-code");
    assert.ok(!html.includes("{{.link}}"), "the body must not print a link");
    assert.ok(!/<a\s[^>]*href="\{\{/.test(html), "the body must not link to a variable");
    assert.ok(!meta.subject.includes(".code"), "the subject must not carry the code");
    assert.ok(meta.subject.includes("{{if eq .purpose"), "the subject follows the purpose");
  });

  const cases: { purpose: string; says: string[]; not: string[] }[] = [
    {
      purpose: "sudo",
      says: ["İşlem Onaylama Kodun", "Hesap Merkezi’nde bir işlemi onaylamak için kodun", "731904", "Bu kodu kimseyle paylaşma."],
      not: ["Giriş Kodun", "Hesap Açma", "Hesap Bağlama", "SKY LAB'e girmek"],
    },
    {
      purpose: "login",
      says: ["Giriş Kodun", "SKY LAB'e girmek için kodun aşağıda.", "731904", "Bu kod 10 dakika geçerli.", "Bu kodu kimseyle paylaşma."],
      not: ["Hesap Açma", "Hesap Bağlama", "Hesap Merkezi"],
    },
    {
      purpose: "signup",
      says: ["Hesap Açma Kodun", "SKY LAB hesabını açmak için", "731904"],
      not: ["Giriş Kodun", "Hesap Bağlama"],
    },
    {
      purpose: "link",
      says: ["Hesap Bağlama Kodun", "YTÜ hesabını SKY LAB hesabına bağlamak için", "731904"],
      not: ["Giriş Kodun", "Hesap Açma"],
    },
  ];
  for (const { purpose, says, not } of cases) {
    it(`words the ${purpose} code`, async () => {
      const { html } = await rendered("keycloak.login-code");
      const filled = fillSampleValues(html, { ...loginSample, purpose });
      const shown = text(filled);
      for (const phrase of says) assert.ok(shown.includes(phrase), `missing "${phrase}" in ${shown}`);
      for (const phrase of not) assert.ok(!shown.includes(phrase), `unexpected "${phrase}" in ${shown}`);
    });
  }

  it("greets by name only when there is one", async () => {
    const { html } = await rendered("keycloak.login-code");
    assert.match(text(fillSampleValues(html, loginSample)), /Merhaba\s+Ada\s*,/);
    assert.ok(!text(fillSampleValues(html, { ...loginSample, firstName: "" })).includes("Merhaba"));
  });

  it("uses a six-digit sample and renders the supplied code unchanged", async () => {
    const { meta, html } = await rendered("keycloak.login-code");
    assert.ok(typeof meta.sample.code === "string");
    assert.match(meta.sample.code, /^[0-9]{6}$/);
    assert.equal(meta.sample.code, loginSample.code);
    assert.match(meta.trigger, /6 haneli/);
    assert.doesNotMatch(meta.trigger, /8 haneli/);
    for (const code of ["008271", "73190452"]) {
      assert.ok(text(fillSampleValues(html, { ...loginSample, code })).includes(code));
    }
  });
});

describe("the Login code alarm", () => {
  it("is a system template an operator may read, with no personal variable", async () => {
    const { meta, html } = await rendered("keycloak.login-code-alarm");
    assert.equal(meta.system, true);
    assert.equal(meta.contentSensitive, false);
    assert.equal(meta.sensitiveVariables, undefined);
    assert.deepEqual([...meta.variables].sort(), ["realmDisplayName", "subjectKey"]);
    const referenced = [...referencedVariables(html)].filter((name) => name !== "Email" && name !== "FullName");
    assert.deepEqual(referenced.sort(), ["realmDisplayName", "subjectKey"]);
    assert.ok(!meta.subject.includes("<no value>"));
  });

  for (const { subjectKey, says, not } of [
    { subjectKey: "skyLoginCodeAlarmHalfSubject", says: ["E-posta Kodu Sınırının Yarısı", "sınırın yarısına ulaştı"], not: ["Sınırı Doldu", "Tavan"] },
    { subjectKey: "skyLoginCodeAlarmFullSubject", says: ["E-posta Kodu Sınırı Doldu", "günlük genel sınıra ulaştı"], not: ["Yarısı", "Tavan"] },
    // Security review K2: the first account of the day at its wrong-code ceiling. Keycloak's nine
    // variables carry no counts, so the mail says "one account" (it goes at the first) and names the
    // setting; the plain-text fallback and the server log carry the numbers.
    {
      subjectKey: "skyLoginCodeAlarmCeilingSubject",
      says: ["Yanlış Kod Tavanı", "bir hesap", "SKY_EMAIL_CODE_WRONG_CODES_PER_ACCOUNT", "sky_email_code_wrong_ceiling"],
      not: ["Yarısı", "Sınırı Doldu"],
    },
    {
      subjectKey: "skyLoginCodeAlarmConsecutiveSubject",
      says: ["Ardışık 100 Yanlış Kod", "bir hesap", "yeniden başlatıldığında", "başarılı giriş", "bakım sıfırlaması"],
      not: ["Yarısı", "Sınırı Doldu", "bugün", "SKY_EMAIL_CODE_WRONG_CODES_PER_ACCOUNT", "günde bir"],
    },
  ]) {
    it(`tells ${subjectKey} apart`, async () => {
      const { html } = await rendered("keycloak.login-code-alarm");
      const shown = text(fillSampleValues(html, { realmDisplayName: "SKY LAB", subjectKey }));
      for (const phrase of says) assert.ok(shown.includes(phrase), `missing "${phrase}" in ${shown}`);
      for (const phrase of not) assert.ok(!shown.includes(phrase), `unexpected "${phrase}" in ${shown}`);
      assert.ok(shown.includes("Keycloak'ın SKY LAB realm'inde"));
    });
  }

  it("gives the persistent ceiling its own person-free subject", async () => {
    const { meta } = await rendered("keycloak.login-code-alarm");
    assert.equal(fillSampleValues(meta.subject, {
      realmDisplayName: "SKY LAB",
      subjectKey: "skyLoginCodeAlarmConsecutiveSubject",
    }, { as: "text" }), "SKY LAB: bir hesap ardışık 100 yanlış e-posta koduna ulaştı");
  });
});
