/**
 * What the account and notice mails say (Yusuf, 2026-10-19): a title, one line
 * of context, the content, the expiry, and in code and link mails the same
 * closing lines; no sentence about why the mail came, no second reassurance.
 * The footer keeps "Sorun bildir", the KVKK link and the credits.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { templates } from "../../../emails";
import { fillSampleValues, renderComponent } from ".";

/** The one mail a person writes; its footer still says who it is for. */
const OPERATOR_WRITTEN = new Set(["free.basic"]);

/**
 * Forms' own mails: their words are Fatih's (forms-frontend mail-templates/),
 * taken as he writes them, footer sentence included. They keep the footer links.
 */
const FORMS_WRITTEN = new Set(["forms.status-changed", "forms.attempt-update"]);

/**
 * A duyuru to many (club.news, duyuru-haber 06): its footer says why this
 * reader got it, in core's words for them (SPEC §5.7: AudienceReason,
 * CategoryLabel), beside their way out of that category.
 */
const ANNOUNCEMENTS = new Set(["club.news"]);

const CODE_MAILS = ["keycloak.login-code", "keycloak.personal-email-confirm"];
const LINK_MAILS = ["keycloak.verify-email", "keycloak.reset-password", "keycloak.update-email", "keycloak.idp-link"];

const NOT_SAID = ["alıyorsun", "aldın", "gönderdik", "asla istemez", "SKY LAB ekibi", "iyi ki geldin", "Aramıza hoş geldin"];

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;|&#39;/g, "'").replace(/\s+/g, " ");

describe("the account and notice mails", () => {
  for (const { meta, Component } of templates) {
    if (OPERATOR_WRITTEN.has(meta.key)) continue;
    const ourWords = !FORMS_WRITTEN.has(meta.key) && !ANNOUNCEMENTS.has(meta.key);
    it(`${meta.key} ${ourWords ? "says nothing about why it came and " : ""}keeps the footer links`, async () => {
      const rendered = await renderComponent(Component);
      assert.ok(rendered.ok);
      for (const body of [text(fillSampleValues(rendered.html, meta.sample)), rendered.plainText]) {
        if (ourWords) {
          for (const phrase of NOT_SAID) assert.ok(!body.includes(phrase), `${meta.key} still says "${phrase}"`);
        }
        assert.ok(body.includes("Sorun bildir") && body.includes("KVKK metni"), `${meta.key}: footer links`);
      }
    });
  }

  for (const key of [...CODE_MAILS, ...LINK_MAILS]) {
    it(`${key} closes with the fixed lines, once each`, async () => {
      const template = templates.find(({ meta }) => meta.key === key);
      assert.ok(template);
      const rendered = await renderComponent(template.Component);
      assert.ok(rendered.ok);
      const body = text(fillSampleValues(rendered.html, template.meta.sample));
      const count = (phrase: string) => body.split(phrase).length - 1;
      assert.equal(count("Bu isteği sen yapmadıysan bu e-postayı yok say."), 1);
      assert.equal(count("Bu kodu kimseyle paylaşma."), CODE_MAILS.includes(key) ? 1 : 0);
      assert.equal(count("dakika geçerli."), 1);
    });
  }
});
