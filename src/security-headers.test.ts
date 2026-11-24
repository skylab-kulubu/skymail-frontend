/**
 * The headers next.config.ts adds: Account Center's set on every path but the
 * render sandbox, which the editor frames and which keeps exactly the
 * policy it had (`sandbox allow-scripts`).
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import config from "../next.config";

// Next.js matches header sources with this same library; it ships no types.
const { pathToRegexp } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (source: string, keys: unknown[], options: { strict: boolean }) => RegExp;
};

describe("the configured headers", async () => {
  const rules = (await config("phase-production-server").headers?.()) ?? [];
  // As Next.js applies them: every matching rule in order, a later one replacing an earlier key.
  const headersOf = (path: string) => {
    const headers = new Map<string, string>();
    for (const { source, headers: list } of rules) {
      if (!pathToRegexp(source, [], { strict: true }).test(path)) continue;
      for (const { key, value } of list) headers.set(key.toLowerCase(), value);
    }
    return headers;
  };

  for (const path of ["/", "/login", "/mail-tasks", "/mail-tasks/show/1", "/templates/edit/3", "/api/health", "/mail/skylab-ink.png", "/monaco/0.55.1/vs/loader.js"]) {
    it(`secures ${path}`, () => {
      const headers = headersOf(path);
      assert.equal(headers.get("x-frame-options"), "DENY");
      assert.equal(headers.get("x-content-type-options"), "nosniff");
      assert.equal(headers.get("referrer-policy"), "same-origin");
      assert.equal(headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
      assert.equal(headers.get("cross-origin-opener-policy"), "same-origin");
      // Mail clients load the logos from other origins.
      assert.equal(headers.has("cross-origin-resource-policy"), false);
    });
  }

  for (const path of ["/render-sandbox/index.html", "/render-sandbox/frame.0123456789abcdef.js"]) {
    it(`leaves ${path} its own policy and lets the editor frame it`, () => {
      const headers = headersOf(path);
      assert.equal(headers.get("content-security-policy"), "sandbox allow-scripts");
      assert.equal(headers.get("referrer-policy"), "no-referrer");
      assert.equal(headers.get("x-content-type-options"), "nosniff");
      assert.equal(headers.has("x-frame-options"), false);
      assert.equal(headers.has("cross-origin-opener-policy"), false);
    });
  }

  it("does not send the powered-by header", () => {
    assert.equal(config("phase-production-server").poweredByHeader, false);
  });
});
