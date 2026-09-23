/**
 * The variables a body references are what the preview asks sample values for
 * and what the Required variable panel will check against. A reference is a
 * field of the data the mailer passes in, used inside a Go action: not a word
 * in the text, not a comment, not a string.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { blockBalance, referencedVariables, renderSource } from ".";

async function variablesOf(mode: "jsx" | "html", source: string): Promise<string[]> {
  const result = await renderSource({ mode, source });
  assert.equal(result.ok, true, result.ok ? "" : result.message);
  assert.ok(result.ok);
  return result.variables;
}

/**
 * The cases skymail-backend's Required variable check is held to as well, from
 * a copy of the same file: the panel shows a template's variables with this
 * reading of a body and the server refuses a save with its own, so the two
 * must not disagree. Change both copies together.
 */
interface SharedCase {
  name: string;
  source: string;
  expect: string[];
}

const SHARED_CASES = join(import.meta.dirname, "testdata", "referenced-variables.json");

/**
 * The shared cases are one file kept in two repos: this copy, and
 * skymail-backend's internal/mailer/testdata/referenced-variables.json, whose
 * test pins the same hash. Changing either copy fails its own repo's test
 * until both copies, and both hashes, change together.
 */
const SHARED_CASES_SHA256 = "b54be25614fedd3054e85589e27ea596b97d2023dc37817058a32d4c08d2bbab";

it("holds the same shared cases as the server", async () => {
  const sum = createHash("sha256").update(await readFile(SHARED_CASES)).digest("hex");
  assert.equal(
    sum,
    SHARED_CASES_SHA256,
    "testdata/referenced-variables.json değişmiş: skymail-backend'deki kopyayı (internal/mailer/testdata/referenced-variables.json) da aynı yap, sonra iki sabiti de güncelle",
  );
});

describe("the variables a body references", async () => {
  const { cases } = JSON.parse(await readFile(SHARED_CASES, "utf8")) as { cases: SharedCase[] };

  it("reads the cases shared with the server", () => {
    assert.ok(cases.length > 0, `${SHARED_CASES} içinde vaka yok`);
  });

  for (const { name, source, expect } of cases) {
    it(`finds ${name}`, async () => {
      assert.deepEqual(await variablesOf("html", source), expect);
    });
  }

  it("finds the fields the emails/go.ts helpers write in a JSX source", async () => {
    const source = `
      import { Text } from "@react-email/components";
      import { cond, elseBranch, end, ifEq, ifSet, v } from "./go";

      export default function Email() {
        return (
          <Text>
            {ifSet("FirstName")}Merhaba {v("FirstName")}{end}
            {ifEq("Decision", "approved")}Onaylandı{elseBranch}Reddedildi{end}
            <a href={cond("TicketUrl", v("TicketUrl"), "https://skyl.app")}>Bilet</a>
          </Text>
        );
      }
    `;

    assert.deepEqual(await variablesOf("jsx", source), ["Decision", "FirstName", "TicketUrl"]);
  });
});

describe("reading actions outside a render", () => {
  // emails:render checks a subject's variables and a body's blocks with the
  // same scanner, rather than with regexes of its own.
  it("finds the variables of a subject", () => {
    assert.deepEqual(referencedVariables("{{ .EventName }} için {{if .Venue}}{{.Venue}}{{end}}"), ["EventName", "Venue"]);
  });

  it("counts the blocks a body opens and the ends that close them, past comments and strings", () => {
    assert.deepEqual(blockBalance('{{if .A}}{{- range .B}}{{end}}'), { opens: 2, ends: 1 });
    assert.deepEqual(blockBalance('{{/* {{if .X}} */}}{{if eq .K "{{end}}"}}x{{ end }}'), { opens: 1, ends: 1 });
  });
});
