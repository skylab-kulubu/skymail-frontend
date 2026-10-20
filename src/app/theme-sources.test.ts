/**
 * globals.css generates the classes of skylcn components only for the
 * `sources/<module>.css` files it imports (Tailwind reads `src` alone). A
 * component imported without its module's file renders unstyled while every
 * other check stays green, so this test ties the two together: every skylcn
 * component the panel imports has its module's stylesheet in globals.css.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

const SRC = join(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const DIST = dirname(require.resolve("@skylab-kulubu/skylcn-ui"));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [join(dir, entry.name)] : [],
  );
}

/** Which module of the package each name the entry point exports comes from: "Notice" → "components/feedback". */
function moduleOfExport(): Map<string, string> {
  const index = readFileSync(join(DIST, "index.js"), "utf8");
  const names = new Map<string, string>();
  for (const [, list, path] of index.matchAll(/export \{([^}]*)\} from '\.\/([^']+)\.js';/g)) {
    for (const name of list.split(",")) {
      const bare = name.replace(/^\s*type\s+/, "").split(" as ").pop()!.trim();
      if (bare) names.set(bare, path);
    }
  }
  return names;
}

function importedNames(): Set<string> {
  const names = new Set<string>();
  for (const file of files(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const [, list] of text.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]@skylab-kulubu\/skylcn-ui['"]/g)) {
      for (const name of list.split(",")) {
        const trimmed = name.trim();
        if (trimmed && !trimmed.startsWith("type ")) names.add(trimmed.split(" as ")[0].trim());
      }
    }
  }
  return names;
}

describe("skylcn-ui stylesheets", () => {
  const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
  const imported = new Set([...css.matchAll(/@import '@skylab-kulubu\/skylcn-ui\/sources\/([\w-]+)\.css';/g)].map((match) => match[1]));
  const modules = moduleOfExport();

  it("has one for every skylcn component the panel imports", () => {
    const missing: string[] = [];
    for (const name of importedNames()) {
      const path = modules.get(name);
      assert.ok(path, `${name} is not exported by skylcn-ui`);
      if (!path.startsWith("components/")) continue; // hooks, the provider, the theme script: no classes
      const file = path.slice("components/".length);
      if (!imported.has(file)) missing.push(`${name} → sources/${file}.css`);
    }
    assert.deepEqual(missing, []);
  });

  it("has the charts' one when the panel draws a skylcn chart", () => {
    const drawsCharts = files(SRC).some((file) =>
      /from\s*['"]@skylab-kulubu\/skylcn-ui\/charts['"]/.test(readFileSync(file, "utf8")),
    );
    if (drawsCharts) assert.ok(imported.has("charts"), "@skylab-kulubu/skylcn-ui/charts → sources/charts.css");
  });

  it("imports only stylesheets the package has", () => {
    const shipped = new Set(readdirSync(join(DIST, "styles/sources")).map((file) => file.replace(/\.css$/, "")));
    for (const file of imported) assert.ok(shipped.has(file), file);
  });
});
