/**
 * The panel's roles after the page loaded (ticket ekip-yetkileri 05): a role
 * granted in Keycloak shows without signing out and in, and the checks stay
 * cheap.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECK_INTERVAL_MS, CONFIRM_INTERVAL_MS, createRoleSync, sameRoles, type RoleSyncOptions } from "./role-sync";

const ACCESS = "skymail:access";
const TEMPLATES = "skymail:templates:read";

function harness(overrides: Partial<RoleSyncOptions> = {}) {
  let time = 1_000_000;
  let shown: readonly string[] = [ACCESS];
  const applied: (readonly string[])[] = [];
  const calls = { read: 0, refresh: 0 };
  let session: readonly string[] | null = [ACCESS];
  const sync = createRoleSync({
    current: () => shown,
    read: async () => {
      calls.read += 1;
      return session;
    },
    refresh: async () => {
      calls.refresh += 1;
      return session;
    },
    apply: (roles) => {
      shown = roles;
      applied.push(roles);
    },
    now: () => time,
    ...overrides,
  });
  return {
    sync,
    calls,
    applied,
    shown: () => shown,
    grant: (roles: readonly string[] | null) => {
      session = roles;
    },
    wait: (ms: number) => {
      time += ms;
    },
  };
}

describe("sameRoles", () => {
  it("ignores order and repeats", () => {
    assert.equal(sameRoles([ACCESS, TEMPLATES], [TEMPLATES, ACCESS, ACCESS]), true);
    assert.equal(sameRoles([ACCESS], [ACCESS, TEMPLATES]), false);
    assert.equal(sameRoles([], []), true);
  });
});

describe("check", () => {
  it("shows a role granted since the page loaded", async () => {
    const h = harness();
    h.grant([ACCESS, TEMPLATES]);
    h.wait(CHECK_INTERVAL_MS);

    await h.sync.check();

    assert.deepEqual(h.shown(), [ACCESS, TEMPLATES]);
    assert.equal(h.applied.length, 1);
    assert.equal(h.calls.refresh, 0, "a check never makes Keycloak refresh the token");
  });

  it("drops a role taken since the page loaded", async () => {
    const h = harness();
    h.grant([]);
    h.wait(CHECK_INTERVAL_MS);

    await h.sync.check();

    assert.deepEqual(h.shown(), []);
  });

  it("changes nothing when the roles are the same", async () => {
    const h = harness();
    h.grant([ACCESS]);
    h.wait(CHECK_INTERVAL_MS);

    await h.sync.check();

    assert.equal(h.calls.read, 1);
    assert.equal(h.applied.length, 0);
  });

  it("does not read right after the page was rendered, nor twice within the interval", async () => {
    const h = harness();
    await h.sync.check();
    assert.equal(h.calls.read, 0);

    h.wait(CHECK_INTERVAL_MS);
    await Promise.all([h.sync.check(), h.sync.check()]);
    await h.sync.check();
    assert.equal(h.calls.read, 1);

    h.wait(CHECK_INTERVAL_MS);
    await h.sync.check();
    assert.equal(h.calls.read, 2);
  });

  it("keeps the roles shown when the session cannot be read", async () => {
    const h = harness({ read: async () => Promise.reject(new TypeError("fetch failed")) });
    h.wait(CHECK_INTERVAL_MS);
    await h.sync.check();

    const none = harness();
    none.grant(null);
    none.wait(CHECK_INTERVAL_MS);
    await none.sync.check();

    assert.deepEqual(h.shown(), [ACCESS]);
    assert.deepEqual(none.shown(), [ACCESS]);
  });
});

describe("confirm", () => {
  it("refreshes now and answers with the new roles", async () => {
    const h = harness();
    h.grant([ACCESS, TEMPLATES]);

    const roles = await h.sync.confirm();

    assert.equal(h.calls.refresh, 1);
    assert.deepEqual(roles, [ACCESS, TEMPLATES]);
    assert.deepEqual(h.shown(), [ACCESS, TEMPLATES]);
  });

  it("answers with the roles shown when the refresh did not happen", async () => {
    const h = harness();
    h.grant(null);
    assert.deepEqual(await h.sync.confirm(), [ACCESS]);

    const failing = harness({ refresh: async () => Promise.reject(new Error("action failed")) });
    assert.deepEqual(await failing.sync.confirm(), [ACCESS]);
  });

  it("shares one refresh between gates that ask together, and asks Keycloak again only after the interval", async () => {
    const h = harness();
    await Promise.all([h.sync.confirm(), h.sync.confirm()]);
    assert.equal(h.calls.refresh, 1);

    h.wait(CONFIRM_INTERVAL_MS - 1);
    await h.sync.confirm();
    assert.equal(h.calls.refresh, 1);

    h.wait(1);
    await h.sync.confirm();
    assert.equal(h.calls.refresh, 2);
  });

  it("makes the next check wait its interval", async () => {
    const h = harness();
    h.wait(CHECK_INTERVAL_MS);
    await h.sync.confirm();
    await h.sync.check();
    assert.equal(h.calls.read, 0);
  });
});
