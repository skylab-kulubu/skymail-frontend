/**
 * The sensitive variables a template lists: the Template seed writes them to
 * SkyMail's `sensitive_variables` (skymail-backend #65), and a sensitive send's
 * masking then hides each one whole, whatever its name or shape.
 *
 * The club's rule is that an operator may read a sensitive mail's content
 * except its codes and one-time links. So a list names only the variables
 * that carry one, and only those SkyMail already masks by their name: listing
 * makes the masking certain (a code made of letters alone, a pass phrase), it
 * never hides more than today. A person's IP address and place are masked by
 * name already (mailer.personalName) and stay off the lists: they are not
 * credentials, and a listed value is also looked for in the masked mail,
 * which a place the mail may name elsewhere would fail.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { templates } from "../../../emails";

/** skymail-backend's variable name rule (pkg/validator IsVariableName). */
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** skymail-backend's limit on a list (requests.UpsertTemplateByKey). */
const LIST_LIMIT = 50;

/**
 * The last words skymail-backend masks a variable by, whatever its value
 * (internal/mailer/mask.go secretNameEnds, the English ones).
 */
const SECRET_NAME_ENDS = [
  "link", "links", "url", "urls", "uri", "href", "code", "codes", "otp", "pin", "token", "tokens",
  "passcode", "password", "secret", "verifier", "invite", "invitation", "nonce", "key",
  "verification", "passphrase",
];

const maskedByName = (name: string) => {
  const lower = name.toLowerCase().replace(/[_\-.\s]/g, "");
  return lower !== "subjectkey" && SECRET_NAME_ENDS.some((end) => lower.endsWith(end));
};

/**
 * Each template's list, checked against the variables its sender passes.
 * Changing a list is changing this table, deliberately. A template not here
 * sends no list, and SkyMail keeps the one it has.
 */
const LISTS: Record<string, string[]> = {
  "keycloak.verify-email": ["link"],
  "keycloak.reset-password": ["link"],
  "keycloak.update-email": ["link"],
  "keycloak.idp-link": ["link"],
  "keycloak.generic": ["link"],
  "keycloak.personal-email-confirm": ["code"],
  "keycloak.login-code": ["code"],
  "account.security-alert": ["SecureAccountUrl"],
  "account.primary-email-changed": ["SecureAccountUrl"],
  "account.deletion-requested": ["CancelUrl"],
  "account.deletion-completed": [],
  "event.ticket-created": ["TicketCode", "TicketQrUrl"],
  "event.reminder": ["TicketQrUrl"],
  "core.contact-consent-confirm": ["confirmUrl", "withdrawUrl"],
};

describe("the sensitive variables declared in emails/", () => {
  it("are the lists checked against the senders' variables", () => {
    const declared = Object.fromEntries(
      templates
        .filter(({ meta }) => meta.sensitiveVariables !== undefined)
        .map(({ meta }) => [meta.key, meta.sensitiveVariables]),
    );
    assert.deepEqual(declared, LISTS);
  });

  for (const { meta } of templates) {
    const list = meta.sensitiveVariables;
    if (list === undefined) {
      continue;
    }

    it(`${meta.key} lists only variables it is sent, as the server accepts them, that SkyMail masks by name today`, () => {
      assert.ok(meta.contentSensitive, `${meta.key}: hassas olmayan bir şablonun gönderimi maskelenmez, liste anlamsız`);
      assert.ok(list.length <= LIST_LIMIT, `${meta.key}: en çok ${LIST_LIMIT} değişken`);
      assert.deepEqual(list, [...new Set(list)].sort(), `${meta.key}: liste sıralı ve tekil olmalı (sunucu öyle saklar)`);
      for (const name of list) {
        assert.match(name, VARIABLE_NAME, `${meta.key}: "${name}" bir değişken adı değil`);
        assert.ok(meta.variables.includes(name), `${meta.key}: "${name}" meta.variables içinde yok`);
        assert.ok(maskedByName(name), `${meta.key}: "${name}" bugün adıyla maskelenmiyor — listelemek operatörden daha fazlasını gizler`);
      }
    });
  }
});
