/**
 * The proxy asks for a session on every path but the few its matcher leaves
 * out. The mail logos must be among those: a mail client fetches them with
 * no session, and a redirect to the sign-in page is a broken image in every
 * mail sent. The console's own pages must not be.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

// Read from the file rather than imported: importing it starts Auth.js.
const source = readFileSync(join(import.meta.dirname, "proxy.ts"), "utf8");
const pattern = /matcher:\s*\["([^"]+)"\]/.exec(source)?.[1];
assert.ok(pattern, "proxy.ts has no matcher");
const guarded = new RegExp(`^${pattern}$`);

describe("the proxy's matcher", () => {
  for (const path of ["/mail/skylab-ink.png", "/mail/skylab-lilac.png", "/skylab.svg", "/api/health"]) {
    it(`lets ${path} through without a session`, () => {
      assert.equal(guarded.test(path), false);
    });
  }

  for (const path of ["/", "/mail-approvals", "/mail-approvals/show/1", "/mail-tasks", "/templates", "/mailing-lists"]) {
    it(`asks for a session on ${path}`, () => {
      assert.equal(guarded.test(path), true);
    });
  }
});
