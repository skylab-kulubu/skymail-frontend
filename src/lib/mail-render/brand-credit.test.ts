/**
 * Which product each template speaks for, and how its footer signs it. The
 * credit follows the product (Yusuf, 2026-10-13): the account product is
 * e-skylab, signed as its sign-in pages are; SkyMail's own mails as SkyMail's
 * sign-in screen; Forms' as Forms'; the club's own mails carry no credit.
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

/** The name on top and in the footer, and the footer's credit (null: none). */
const SIGNED: Record<Brand, { name: string; credit: string | null }> = {
  account: { name: "e-skylab", credit: "Developed by Yusuf Açmacı" },
  mail: { name: "SKY LAB Mail", credit: "Developed by Enes Genç" },
  forms: { name: "SKY LAB Forms", credit: "Developed by Fatih Naz" },
  skylab: { name: "SKY LAB", credit: null },
};

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the product each template speaks for", () => {
  it("is the one decided for every template", () => {
    assert.deepEqual(Object.fromEntries(templates.map(({ meta }) => [meta.key, meta.brand])), BRAND_OF);
  });

  for (const { meta, Component } of templates) {
    const { name, credit } = SIGNED[meta.brand];
    it(`${meta.key} is signed ${name}${credit ? `, ${credit}` : ", with no credit"}`, async () => {
      const rendered = await renderComponent(Component);
      assert.ok(rendered.ok);
      const shown = text(rendered.html);
      assert.ok(shown.includes(` ${name} by WEBLAB`), `${meta.key}: footer does not read "${name} by WEBLAB"`);
      const header = /data-skip-in-text="true">\s*<tbody>[\s\S]*?<\/table>/.exec(rendered.html)?.[0] ?? "";
      assert.ok(text(header).includes(` ${name} `), `${meta.key}: the name on top is not "${name}"`);
      if (credit) {
        assert.equal(shown.split(credit).length - 1, 1, `${meta.key}: "${credit}" is not in the footer once`);
      }
      assert.equal(
        (shown.match(/Developed by/g) ?? []).length,
        credit ? 1 : 0,
        `${meta.key}: wrong credit`,
      );
      assert.ok(!shown.includes("SKY LAB Hesap"), `${meta.key}: still names "SKY LAB Hesap"`);
    });
  }
});
