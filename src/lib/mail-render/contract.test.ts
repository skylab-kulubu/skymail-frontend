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

describe("the contract Required variables declared in emails/", () => {
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

    it(`${meta.key} declares names the server accepts, each once, among the variables its sender provides`, () => {
      assert.equal(new Set(contract).size, contract.length, `${meta.key}: requiredVariables tekrar ediyor`);
      for (const name of contract) {
        assert.match(name, VARIABLE_NAME, `${meta.key}: "${name}" bir değişken adı değil`);
        assert.ok(meta.variables.includes(name), `${meta.key}: "${name}" meta.variables içinde yok — gönderen onu göndermiyorsa sözleşme olamaz`);
      }
    });

    it(`${meta.key}'s body references ${contract.join(", ")}`, async () => {
      const rendered = await renderComponent(Component);
      assert.equal(rendered.ok, true, rendered.ok ? "" : rendered.message);
      assert.ok(rendered.ok);
      const missing = contract.filter((name) => !rendered.variables.includes(name));
      assert.deepEqual(missing, [], `${meta.key}: gövde sözleşme değişkenlerine başvurmuyor — seed reddedilir`);
    });
  }
});
