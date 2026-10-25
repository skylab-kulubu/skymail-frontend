/**
 * Which product each template speaks for, and how its footer credits it
 * (Yusuf, 2026-10-13). Every mail ends with SkyMail's line, since SkyMail
 * sends them all; e-skylab's (the account product) and Forms' mails have
 * their own line above it. SkyMail's own mails and the club's have only
 * SkyMail's: SKY LAB is the club, not a product.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { templates } from "../../../emails";
import type { Brand } from "../../../emails/theme";
import { fillSampleValues, renderComponent } from ".";

const BRAND_OF: Record<string, Brand> = {
  "free.basic": "skylab",
  "keycloak.verify-email": "account",
  "keycloak.reset-password": "account",
  "keycloak.update-email": "account",
  "keycloak.idp-link": "account",
  "keycloak.personal-email-confirm": "account",
  "keycloak.login-code": "account",
  "keycloak.login-code-alarm": "account",
  "keycloak.generic": "account",
  "core.welcome": "skylab",
  "core.certificate": "skylab",
  "core.event-cancelled": "skylab",
  "core.event-reinstated": "skylab",
  "core.feedback-request": "skylab",
  "core.feedback-reminder": "skylab",
  "core.contact-consent-confirm": "skylab",
  "account.security-alert": "account",
  "account.primary-email-changed": "account",
  "account.deletion-requested": "account",
  "account.deletion-completed": "account",
  "event.ticket-created": "skylab",
  "event.reminder": "skylab",
  "event.updated": "skylab",
  "mail.approval-requested": "mail",
  "mail.approval-resolved": "mail",
  "ops.send-failed": "mail",
  "club.team-membership": "account",
  "club.role-membership": "account",
  "club.group-membership": "account",
  "club.privilege-change": "account",
  "club.news": "skylab",
  "forms.status-changed": "forms",
  "forms.attempt-update": "forms",
  "forms.form-copy": "forms",
  "forms.pending-reminder": "forms",
};

/** The name beside the logo, and the footer's credit lines, last one last. */
const SKYMAIL_LINE = "SkyMail by WEBLAB Developed by Enes Genç";
const SIGNED: Record<Brand, { name: string; credits: string[] }> = {
  account: { name: "e-skylab", credits: ["e-skylab by WEBLAB Developed by Yusuf Açmacı", SKYMAIL_LINE] },
  forms: { name: "SKY LAB Forms", credits: ["SKY LAB Forms by WEBLAB Developed by Fatih Naz", SKYMAIL_LINE] },
  mail: { name: "SKY LAB İletişim", credits: [SKYMAIL_LINE] },
  skylab: { name: "SKY LAB", credits: [SKYMAIL_LINE] },
};

/** Where each credit links. */
const LINKS: Record<string, string> = {
  "Developed by Enes Genç": "https://enesgenc.dev",
  "Developed by Fatih Naz": "https://github.com/fatiihnaz",
  "Developed by Yusuf Açmacı": "https://www.linkedin.com/in/yusuf-acmaci/",
};

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** The plain text's non-empty lines, their addresses dropped. */
const lines = (plainText: string) =>
  plainText
    .split("\n")
    .map((line) => line.replace(/ (?:https?|mailto):\S+/g, "").trim())
    .filter(Boolean);

describe("the product each template speaks for", () => {
  it("is the one decided for every template", () => {
    assert.deepEqual(Object.fromEntries(templates.map(({ meta }) => [meta.key, meta.brand])), BRAND_OF);
  });

  for (const { meta, Component } of templates) {
    const { name, credits } = SIGNED[meta.brand];
    it(`${meta.key} is signed ${name}, ending ${credits.join(" / ")}`, async () => {
      const rendered = await renderComponent(Component);
      assert.ok(rendered.ok);
      const header = /data-skip-in-text="true">\s*<tbody>[\s\S]*?<\/table>/.exec(rendered.html)?.[0] ?? "";
      assert.ok(text(header).includes(` ${name} `), `${meta.key}: the name beside the logo is not "${name}"`);

      assert.deepEqual(lines(rendered.plainText).slice(-credits.length), credits, `${meta.key}: footer`);
      assert.equal(rendered.plainText.split("by WEBLAB").length - 1, credits.length, `${meta.key}: credit lines`);
      assert.equal(rendered.plainText.split("Developed by").length - 1, credits.length, `${meta.key}: credits`);

      for (const [credit, href] of Object.entries(LINKS)) {
        if (credits.some((line) => line.includes(credit))) {
          assert.match(rendered.html, new RegExp(`<a[^>]*href="${href}"[^>]*>\\s*${credit.replaceAll(" ", "\\s+")}\\s*</a`), `${meta.key}: "${credit}" is not linked`);
        }
      }
      assert.ok(!/SKY LAB (Mail |İletişim )?by WEBLAB/.test(rendered.plainText), `${meta.key}: a club or SKY LAB İletişim product line`);
      assert.ok(!rendered.plainText.includes("SKY LAB Hesap"), `${meta.key}: still names "SKY LAB Hesap"`);
    });
  }
});

/**
 * The footer's link to the Account center's communication preferences
 * (skymail-backend bounce ticket 11): every mail but the account mails, which
 * go whatever the preferences say, beside "Sorun bildir" and the KVKK link.
 */
const PREFERENCES = "https://my.yildizskylab.com/communication-preferences";

describe("the footer's communication preferences link", () => {
  for (const { meta, Component } of templates) {
    const shown = meta.brand !== "account";
    it(`${meta.key} ${shown ? "links" : "does not link"} the communication preferences`, async () => {
      const rendered = await renderComponent(Component);
      assert.ok(rendered.ok);
      const linked = new RegExp(`<a[^>]*href="${PREFERENCES}"[^>]*>\\s*İletişim tercihleri\\s*</a`).test(rendered.html);
      assert.equal(linked, shown, `${meta.key}: the HTML link`);
      assert.equal(rendered.plainText.includes("İletişim tercihleri"), shown, `${meta.key}: the plain text`);
      assert.equal(rendered.plainText.includes(PREFERENCES), shown, `${meta.key}: the plain text's address`);
    });
  }
});

/**
 * The footer's "Abonelikten çık" (abonelik-cikisi 05; ADR 0072): SkyMail
 * gives a mail of the duyuru stream the recipient's own unsubscribe link as
 * .UnsubscribeUrl, and no other mail any. Every footer but the account mails'
 * shows it, before "İletişim tercihleri", only when it is set: an empty one
 * leaves the footer as it was.
 */
const UNSUBSCRIBE = "https://mail.yildizskylab.com/api/skymail/u/ornek";

describe("the footer's unsubscribe link", () => {
  for (const { meta, Component } of templates) {
    const shown = meta.brand !== "account";
    it(`${meta.key} ${shown ? "links the unsubscribe link when it is set" : "has no unsubscribe link"}`, async () => {
      const rendered = await renderComponent(Component);
      assert.ok(rendered.ok);
      assert.equal(rendered.variables.includes("UnsubscribeUrl"), shown, `${meta.key}: reads .UnsubscribeUrl`);

      const set = { ...meta.sample, UnsubscribeUrl: UNSUBSCRIBE };
      const html = fillSampleValues(rendered.html, set);
      const text = fillSampleValues(rendered.plainText, set, { as: "text" });
      const linked = new RegExp(
        `<a[^>]*href="${UNSUBSCRIBE}"[^>]*>\\s*Abonelikten çık\\s*</a[\\s\\S]*?<a[^>]*href="${PREFERENCES}"[^>]*>\\s*İletişim tercihleri`,
      ).test(html);
      assert.equal(linked, shown, `${meta.key}: the HTML link, before the preferences`);
      assert.equal(text.includes(`Abonelikten çık ${UNSUBSCRIBE} · İletişim tercihleri`), shown, `${meta.key}: the plain text`);

      const empty = fillSampleValues(rendered.html, meta.sample);
      const emptyText = fillSampleValues(rendered.plainText, meta.sample, { as: "text" });
      assert.ok(!empty.includes("Abonelikten çık") && !emptyText.includes("Abonelikten çık"), `${meta.key}: nothing when empty`);
      assert.ok(!empty.includes("UnsubscribeUrl") && !emptyText.includes("UnsubscribeUrl"), `${meta.key}: no action left`);
      if (shown) {
        assert.match(empty, new RegExp(`KVKK metni</a\\s*>\\s*·\\s*(<!-- -->)?<a[^>]*href="${PREFERENCES}"`), `${meta.key}: the footer as before`);
        assert.ok(emptyText.includes(`kvkk-metni.pdf · İletişim tercihleri ${PREFERENCES}`), `${meta.key}: the plain footer as before`);
      }
    });
  }
});
