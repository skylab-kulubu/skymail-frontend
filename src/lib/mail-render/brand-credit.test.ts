/**
 * Which product each template speaks for, and how its footer signs it
 * (Yusuf, 2026-10-13). The account product is e-skylab; SKY LAB is the club,
 * not a product, so its mails have no "<product> by WEBLAB" line. SkyMail
 * sends every one of them, so every credit names Enes Genç, after the
 * product's own developer.
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
  "keycloak.generic": "account",
  "core.welcome": "skylab",
  "core.certificate": "skylab",
  "account.security-alert": "account",
  "account.primary-email-changed": "account",
  "account.deletion-requested": "account",
  "account.deletion-completed": "account",
  "event.ticket-created": "skylab",
  "event.reminder": "skylab",
  "event.updated": "skylab",
  "event.cancelled": "skylab",
  "mail.approval-requested": "mail",
  "mail.approval-resolved": "mail",
  "ops.send-failed": "mail",
  "club.team-membership": "account",
  "club.role-membership": "account",
  "club.group-membership": "account",
  "club.privilege-change": "account",
};

/** The name on top, the footer's product line (null: none) and its credit. */
const SIGNED: Record<Brand, { name: string; productLine: string | null; credit: string }> = {
  account: { name: "e-skylab", productLine: "e-skylab by WEBLAB", credit: "Developed by Yusuf Açmacı & Enes Genç" },
  mail: { name: "SKY LAB Mail", productLine: "SKY LAB Mail by WEBLAB", credit: "Developed by Enes Genç" },
  forms: { name: "SKY LAB Forms", productLine: "SKY LAB Forms by WEBLAB", credit: "Developed by Fatih Naz & Enes Genç" },
  skylab: { name: "SKY LAB", productLine: null, credit: "Developed by Enes Genç" },
};

const LINKS: Record<string, string> = { "Enes Genç": "https://enesgenc.dev", "Fatih Naz": "https://github.com/fatiihnaz" };

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** The plain text's last line, its addresses dropped: the product line and the credit. */
const lastLine = (plainText: string) =>
  plainText.trim().split("\n").at(-1)!.replace(/ (?:https?|mailto):\S+/g, "").trim();

describe("the product each template speaks for", () => {
  it("is the one decided for every template", () => {
    assert.deepEqual(Object.fromEntries(templates.map(({ meta }) => [meta.key, meta.brand])), BRAND_OF);
  });

  for (const { meta, Component } of templates) {
    const { name, productLine, credit } = SIGNED[meta.brand];
    it(`${meta.key} is signed ${name}, ${productLine ?? "no product line"}, ${credit}`, async () => {
      const rendered = await renderComponent(Component);
      assert.ok(rendered.ok);
      const header = /data-skip-in-text="true">\s*<tbody>[\s\S]*?<\/table>/.exec(rendered.html)?.[0] ?? "";
      assert.ok(text(header).includes(` ${name} `), `${meta.key}: the name on top is not "${name}"`);

      assert.equal(lastLine(rendered.plainText), [productLine, credit].filter(Boolean).join(" "), `${meta.key}: footer`);
      assert.equal(rendered.plainText.split("by WEBLAB").length - 1, productLine ? 1 : 0, `${meta.key}: product lines`);
      assert.equal(rendered.plainText.split("Developed by").length - 1, 1, `${meta.key}: credits`);
      for (const [developer, href] of Object.entries(LINKS)) {
        if (credit.includes(developer)) {
          assert.match(rendered.html, new RegExp(`<a[^>]*href="${href}"[^>]*>\\s*${developer}\\s*</a`), `${meta.key}: ${developer} is not linked`);
        }
      }
      if (credit.includes("Yusuf Açmacı")) {
        assert.ok(!/<a[^>]*>\s*Yusuf Açmacı\s*<\/a/.test(rendered.html), `${meta.key}: Yusuf Açmacı is linked`);
      }
      assert.ok(!rendered.plainText.includes("SKY LAB Hesap"), `${meta.key}: still names "SKY LAB Hesap"`);
    });
  }
});
