/**
 * The proxy asks for a session on every path but the few its matcher leaves
 * out. The mail logos must be among those: a mail client fetches them with
 * no session, and a redirect to the sign-in page is a broken image in every
 * mail sent. Only they: any other path under /mail/ is a console page like any
 * other, guarded, and never marked for a shared cache.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import config from "../next.config";

// Read from the file rather than imported: importing it starts Auth.js.
const source = readFileSync(join(import.meta.dirname, "proxy.ts"), "utf8");
const literal = /matcher:\s*\[("(?:[^"\\]|\\.)+")\]/.exec(source)?.[1];
assert.ok(literal, "proxy.ts has no matcher");
// The string as the module holds it, escapes resolved.
const pattern = JSON.parse(literal) as string;
const guarded = new RegExp(`^${pattern}$`);

describe("the proxy's matcher", () => {
  for (const path of ["/mail/skylab-ink.png", "/mail/skylab-lilac.png", "/skylab.svg", "/api/health"]) {
    it(`lets ${path} through without a session`, () => {
      assert.equal(guarded.test(path), false);
    });
  }

  for (const path of [
    "/",
    "/mail-approvals",
    "/mail-approvals/show/1",
    "/mail-tasks",
    "/templates",
    "/mailing-lists",
    "/mail/nope",
    "/mail/x.png",
    "/mail/x/y.png",
    "/mail/skylab-ink.png/x",
    "/mail/skylab-ink.pngx",
  ]) {
    it(`asks for a session on ${path}`, () => {
      assert.equal(guarded.test(path), true);
    });
  }
});

// Next.js matches header sources with this same library; it ships no types.
const { pathToRegexp } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (source: string, keys: unknown[], options: { strict: boolean }) => RegExp;
};

describe("the cache header on /mail/", async () => {
  const rules = (await config("phase-production-server").headers?.()) ?? [];
  const cacheControlOf = (path: string) =>
    rules
      .filter(({ source }) => pathToRegexp(source, [], { strict: true }).test(path))
      .flatMap(({ headers }) => headers)
      .find(({ key }) => key.toLowerCase() === "cache-control")?.value;

  for (const path of ["/mail/skylab-ink.png", "/mail/skylab-lilac.png"]) {
    it(`lets a shared cache keep ${path}`, () => {
      assert.match(cacheControlOf(path) ?? "", /^public, max-age=\d+$/);
    });
  }

  for (const path of ["/mail/nope", "/mail/x.png", "/mail/x/y.png", "/mail/skylab-ink.png/x"]) {
    it(`does not mark ${path} public, which may be a signed-in page`, () => {
      assert.equal(cacheControlOf(path), undefined);
    });
  }
});
