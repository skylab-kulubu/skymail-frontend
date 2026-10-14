/**
 * What the services that send by key rely on, locked per template: the
 * subject, the flags the seed writes, the variables the body reads and the
 * Go actions it branches on. A change of layout (the Forms-style shell of
 * 2026-10) must leave all of it as it was; changing any of it is changing
 * testdata/template-contracts.json, deliberately, in the same commit.
 *
 * Regenerate the file only for a deliberate change:
 *   UPDATE_TEMPLATE_CONTRACTS=1 corepack yarn tsx --test src/lib/mail-render/template-contracts.test.ts
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { templates } from "../../../emails";
import { findActions } from "./go-template";
import { renderComponent } from ".";

const FILE = join(import.meta.dirname, "testdata", "template-contracts.json");

interface Contract {
  subject: string;
  system: boolean;
  contentSensitive: boolean;
  variables: string[];
  requiredVariables: string[];
  /** null: the seed sends no list, and SkyMail keeps the one it has. */
  sensitiveVariables: string[] | null;
  sampleKeys: string[];
  /** The fields the rendered body reads. */
  referenced: string[];
  /** Every distinct Go action in the rendered body but else and end, whitespace collapsed. */
  actions: string[];
}

const normalized = (action: string) => action.replace(/\s+/g, " ").replace(/^\{\{ /, "{{").replace(/ \}\}$/, "}}");

async function contractOf(index: number): Promise<Contract> {
  const { meta, Component } = templates[index];
  const rendered = await renderComponent(Component);
  assert.ok(rendered.ok, `${meta.key}: ${rendered.ok ? "" : rendered.message}`);
  const actions = new Set(
    findActions(rendered.html)
      .map(({ start, end }) => normalized(rendered.html.slice(start, end)))
      .filter((action) => action !== "{{else}}" && action !== "{{end}}"),
  );
  return {
    subject: meta.subject,
    system: meta.system,
    contentSensitive: meta.contentSensitive,
    variables: [...meta.variables],
    requiredVariables: (meta.requiredVariables ?? []).map(({ name }) => name),
    sensitiveVariables: meta.sensitiveVariables ? [...meta.sensitiveVariables] : null,
    sampleKeys: Object.keys(meta.sample).sort(),
    referenced: [...rendered.variables].sort(),
    actions: [...actions].sort(),
  };
}

describe("the contract each template keeps with its sender", async () => {
  const current: Record<string, Contract> = {};
  for (const [index, { meta }] of templates.entries()) {
    current[meta.key] = await contractOf(index);
  }

  if (process.env.UPDATE_TEMPLATE_CONTRACTS === "1") {
    await writeFile(FILE, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  }
  const locked = JSON.parse(await readFile(FILE, "utf8")) as Record<string, Contract>;

  it("covers the same templates", () => {
    assert.deepEqual(Object.keys(current).sort(), Object.keys(locked).sort());
  });

  for (const key of Object.keys(locked)) {
    it(`${key} keeps its subject, flags, variables and branches`, () => {
      assert.deepEqual(current[key], locked[key]);
    });
  }
});
