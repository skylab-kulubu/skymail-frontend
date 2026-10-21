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
import { renderComponent } from ".";

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
  "forms.status-changed": "forms",
  "forms.attempt-update": "forms",
};

/** The name beside the logo, and the footer's credit lines, last one last. */
const SKYMAIL_LINE = "SkyMail by WEBLAB Developed by Enes Genç";
const SIGNED: Record<Brand, { name: string; credits: string[] }> = {
  account: { name: "e-skylab", credits: ["e-skylab by WEBLAB Developed by Yusuf Açmacı", SKYMAIL_LINE] },
  forms: { name: "SKY LAB Forms", credits: ["SKY LAB Forms by WEBLAB Developed by Fatih Naz", SKYMAIL_LINE] },
  mail: { name: "SKY LAB Mail", credits: [SKYMAIL_LINE] },
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
      assert.ok(!/SKY LAB (Mail )?by WEBLAB/.test(rendered.plainText), `${meta.key}: a club or SKY LAB Mail product line`);
      assert.ok(!rendered.plainText.includes("SKY LAB Hesap"), `${meta.key}: still names "SKY LAB Hesap"`);
    });
  }
});
