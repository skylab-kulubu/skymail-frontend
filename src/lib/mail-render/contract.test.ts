/**
 * A System template's contract Required variables are declared beside its
 * Template key and written by the Template seed. SkyMail then refuses every
 * save and publish whose body no longer references one of them — the seed's
 * own included. So the body the repo renders must reference each, counted by
 * the rule the server counts with (see variables.test.ts), or the seed would
 * be refused and the panel would show a contract the mail does not keep.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { templates } from "../../../emails";
import { renderComponent } from ".";

/** skymail-backend's variable name rule (pkg/validator IsVariableName). */
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** skymail-backend's limit on a reason (requests.ContractVariable). */
const REASON_LIMIT = 300;

/**
 * The contract of each System template, as checked against the code of the
 * service that sends it (ticket 08's table). A variable belongs here only if
 * the sender always passes it and the mail cannot work without it: the
 * Keycloak provider sends keycloak.generic's link as "" for event mails, so it
 * has none; core's welcome has no action; nothing sends the account mails yet.
 * Changing a contract is changing this list, deliberately.
 */
const CONTRACTS: Record<string, string[]> = {
  "keycloak.verify-email": ["link"],
  "keycloak.reset-password": ["link"],
  "keycloak.update-email": ["link"],
  "keycloak.idp-link": ["link"],
  "keycloak.personal-email-confirm": ["code"],
  "keycloak.generic": [],
  "core.welcome": [],
  "core.certificate": ["VerifyURL"],
  "account.security-alert": [],
  "account.primary-email-changed": [],
  "account.deletion-requested": [],
  "account.deletion-completed": [],
};

describe("the contract Required variables declared in emails/", () => {
  it("are the contracts checked against the senders' code, one for every System template", () => {
    const declared = Object.fromEntries(
      templates
        .filter(({ meta }) => meta.system)
        .map(({ meta }) => [meta.key, (meta.requiredVariables ?? []).map(({ name }) => name)]),
    );
    assert.deepEqual(declared, CONTRACTS);
  });

  for (const { meta, Component } of templates) {
    const contract = meta.requiredVariables;

    if (meta.system) {
      // A service sends it by key, so whether it has a contract is a decision
      // someone made, not an omission — even when the answer is none.
      it(`${meta.key} states its contract`, () => {
        assert.ok(Array.isArray(contract), `${meta.key}: bir System template requiredVariables tanımlamalı (boş da olabilir)`);
      });
    }

    if (!contract || contract.length === 0) {
      continue;
    }

    it(`${meta.key} names each variable once, as the server accepts it, among those its sender provides, and says why`, () => {
      const names = contract.map(({ name }) => name);
      assert.equal(new Set(names).size, names.length, `${meta.key}: requiredVariables tekrar ediyor`);
      for (const { name, reason } of contract) {
        assert.match(name, VARIABLE_NAME, `${meta.key}: "${name}" bir değişken adı değil`);
        assert.ok(meta.variables.includes(name), `${meta.key}: "${name}" meta.variables içinde yok — gönderen onu göndermiyorsa sözleşme olamaz`);
        assert.ok(reason.trim().length > 0, `${meta.key}: "${name}" neden gerektiğini söylemiyor`);
        assert.ok(reason.length <= REASON_LIMIT, `${meta.key}: "${name}" gerekçesi ${REASON_LIMIT} karakterden uzun`);
      }
    });

    it(`${meta.key}'s body references ${contract.map(({ name }) => name).join(", ")}`, async () => {
      const rendered = await renderComponent(Component);
      assert.equal(rendered.ok, true, rendered.ok ? "" : rendered.message);
      assert.ok(rendered.ok);
      const missing = contract.filter(({ name }) => !rendered.variables.includes(name)).map(({ name }) => name);
      assert.deepEqual(missing, [], `${meta.key}: gövde sözleşme değişkenlerine başvurmuyor — seed reddedilir`);
    });
  }
});
