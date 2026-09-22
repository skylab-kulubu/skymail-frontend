/**
 * JSX mode is the panel's code editor. The property that has to hold is the one
 * ADR-0046 kept the in-browser compiler for: a template written in the repo
 * opens in the panel exactly as it is, and the panel sends the same mail the
 * Template seed would have written.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { render } from "@react-email/render";
import { templates } from "../../../emails";
import { renderSource } from ".";

const EMAILS_DIR = join(import.meta.dirname, "..", "..", "..", "emails");

/** Each template's file, found by the key it declares rather than by its name. */
async function sourcesByKey(): Promise<Map<string, string>> {
  const sources = new Map<string, string>();
  for (const file of await readdir(EMAILS_DIR)) {
    if (!file.endsWith(".tsx")) {
      continue;
    }
    const text = await readFile(join(EMAILS_DIR, file), "utf8");
    const key = /\bkey:\s*"([^"]+)"/.exec(text)?.[1];
    if (key) {
      sources.set(key, text);
    }
  }
  return sources;
}

describe("a template from the repo, compiled from its file as it is", async () => {
  const sources = await sourcesByKey();

  for (const { meta, Component } of templates) {
    it(`${meta.key} comes out as the Template seed has always written it`, async () => {
      const source = sources.get(meta.key);
      assert.ok(source, `emails/ içinde key: "${meta.key}" tanımlayan bir .tsx yok`);

      const result = await renderSource({ mode: "jsx", source });

      assert.equal(result.ok, true, result.ok ? "" : result.message);
      // What scripts/seed-templates.ts wrote before it rendered through this module.
      assert.equal(result.html, await render(createElement(Component), { pretty: true }));
      assert.equal(result.plainText, await render(createElement(Component), { plainText: true }));
    });
  }
});

describe("JSX mode", () => {
  it("renders a component written in the editor", async () => {
    const result = await renderSource({
      mode: "jsx",
      source: 'import { Text } from "@react-email/components";\nexport default () => <Text>Merhaba</Text>;',
    });

    assert.equal(result.ok, true, result.ok ? "" : result.message);
    assert.match(result.html, /<p[^>]*>\s*Merhaba\s*<\/p>/);
    assert.equal(result.plainText, "Merhaba");
  });

  it("still compiles a body written for the old editor, which offered React Email without imports", async () => {
    const result = await renderSource({
      mode: "jsx",
      source: "export default function Email() {\n  return <Html><Body><Text>Eski editör</Text></Body></Html>;\n}\n",
    });

    assert.equal(result.ok, true, result.ok ? "" : result.message);
    assert.match(result.plainText, /Eski editör/);
  });

  it("lets a source name its own component after a React Email one", async () => {
    const result = await renderSource({
      mode: "jsx",
      source: "const Heading = () => <p>Kendi başlığım</p>;\nexport default () => <Heading />;",
    });

    assert.equal(result.ok, true, result.ok ? "" : result.message);
    assert.equal(result.plainText, "Kendi başlığım");
  });

  const failures: { name: string; source: string; reason: string; says?: RegExp }[] = [
    {
      name: "code Babel cannot compile",
      source: "export default () => <p>Merhaba</p",
      reason: "compile",
    },
    {
      name: "an import nothing provides",
      source: 'import { Wat } from "left-pad";\nexport default () => <p>{Wat}</p>;',
      reason: "compile",
      says: /"left-pad"/,
    },
    {
      // What seed-templates.ts wrote into react_email_content before ticket 09.
      name: "the seed's pointer comment",
      source: "// Kaynak: skymail-frontend/emails/core-welcome.tsx — burada düzenlersen repodaki kaynakla ayrışır.\n",
      reason: "no-component",
    },
    {
      name: "a default export that is not a component",
      source: 'export default "Merhaba";',
      reason: "no-component",
    },
    {
      name: "a module that throws while it loads",
      source: 'throw new Error("yüklenirken");\nexport default () => <p>Merhaba</p>;',
      reason: "render",
      says: /yüklenirken/,
    },
    {
      name: "a component that throws",
      source: 'export default function Email() { throw new Error("render sırasında"); }',
      reason: "render",
      says: /render sırasında/,
    },
    {
      name: "a component that throws below the root",
      source:
        'const Broken = () => { throw new Error("alt bileşende"); };\nexport default () => <div><p>Merhaba</p><Broken /></div>;',
      reason: "render",
      says: /alt bileşende/,
    },
    {
      name: "a component that renders nothing",
      source: "export default () => null;",
      reason: "empty",
    },
  ];

  for (const { name, source, reason, says } of failures) {
    it(`reports ${name} as ${reason}, with no body`, async () => {
      const result = await renderSource({ mode: "jsx", source });

      assert.equal(result.ok, false);
      assert.ok(!result.ok);
      assert.equal(result.reason, reason, result.message);
      assert.ok(!("html" in result), "a failed render must not carry a body");
      if (says) {
        assert.match(result.message, says);
      }
    });
  }
});
