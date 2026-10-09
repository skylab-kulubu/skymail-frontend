/**
 * The container's health check (Dockerfile HEALTHCHECK) polls this route, and
 * Swarm's start-first deploy waits for it before it stops the old task. It must
 * answer from the server process alone: if it asked Keycloak or the SkyMail API,
 * their short outage would restart every SkyMail panel task at once.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dynamic, GET } from "./route";

describe("the health route", () => {
  it("answers 200 without reaching anything outside the process", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = () => assert.fail("the health route must not call out");
    try {
      const response = GET();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok" });
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("is never cached and never indexed", () => {
    const response = GET();
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
  });

  it("runs on every request rather than being prerendered at build", () => {
    assert.equal(dynamic, "force-dynamic");
  });
});
