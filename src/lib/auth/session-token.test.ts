/**
 * The session token is what Auth.js keeps in its encrypted cookie between
 * requests. These tests drive the two moments that shape it — signing in and
 * reading a session whose access token is about to expire — with Keycloak's
 * token endpoint replaced by a fetch double.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRefreshStore,
  refreshIfExpiring,
  sessionFromToken,
  tokenFromSignIn,
  type RefreshOptions,
  type SessionToken,
} from "./session-token";

const ISSUER = "https://e.example.test/realms/e-skylab-sandbox";
const CLIENT_ID = "skymail";
const NOW = Date.UTC(2026, 8, 22, 12, 0, 0);

/** An unsigned JWT with the given payload: enough for code that only reads claims. */
function accessToken(payload: Record<string, unknown>): string {
  const encode = (part: unknown) => Buffer.from(JSON.stringify(part)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function tokenWithRoles(roles: string[]): string {
  return accessToken({
    sub: "user-1",
    resource_access: {
      skymail: { roles },
      forms: { roles: ["skyforms:access"] },
      account: { roles: ["manage-account"] },
    },
    realm_access: { roles: ["offline_access"] },
  });
}

describe("signing in", () => {
  it("keeps SkyMail's client roles from the access token and nothing else", () => {
    const token = tokenFromSignIn(
      {
        access_token: tokenWithRoles(["skymail:access", "skymail:templates:read"]),
        refresh_token: "refresh-1",
        id_token: "id-1",
        expires_at: NOW / 1000 + 300,
      },
      { clientId: CLIENT_ID, profile: { name: "Ada Lovelace", email: "ada@example.test" } },
    );

    assert.deepEqual(token.roles, ["skymail:access", "skymail:templates:read"]);
    assert.equal(token.refreshToken, "refresh-1");
    assert.equal(token.idToken, "id-1");
    assert.equal(token.expiresAt, NOW + 300_000);
    assert.deepEqual(token.user, { name: "Ada Lovelace", email: "ada@example.test" });
    assert.equal(token.error, undefined);
  });

  it("gives no roles to someone the client never granted any", () => {
    const token = tokenFromSignIn(
      { access_token: accessToken({ sub: "user-2" }), expires_at: NOW / 1000 + 300 },
      { clientId: CLIENT_ID, profile: {} },
    );

    assert.deepEqual(token.roles, []);
  });
});

type TokenCall = { url: string; headers: Headers; body: URLSearchParams };

function tokenEndpoint(answer: () => Response | Promise<Response>) {
  const calls: TokenCall[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: new URLSearchParams(String(init?.body ?? "")),
    });
    return answer();
  };
  return { fetch, calls };
}

/** Each test gets its own refresh store, so no test sees another's refreshes. */
function options(fetch: typeof globalThis.fetch, now: () => number = () => NOW): RefreshOptions {
  return { issuer: ISSUER, clientId: CLIENT_ID, fetch, now, store: createRefreshStore() };
}

function signedIn(overrides: Partial<SessionToken> = {}): SessionToken {
  return {
    accessToken: tokenWithRoles(["skymail:access"]),
    refreshToken: "refresh-1",
    idToken: "id-1",
    expiresAt: NOW + 10 * 60_000,
    roles: ["skymail:access"],
    subject: "user-1",
    user: { name: "Ada Lovelace" },
    ...overrides,
  };
}

describe("reading the session", () => {
  it("leaves a token with time left on it alone", async () => {
    const { fetch, calls } = tokenEndpoint(() => assert.fail("no refresh expected"));
    const token = signedIn();

    const next = await refreshIfExpiring(token, options(fetch));

    assert.equal(next, token);
    assert.equal(calls.length, 0);
  });

  // skymail is a public client: it has no secret, and Keycloak refuses a
  // refresh that presents one it does not know.
  it("refreshes a token about to expire as a public client, without a secret", async () => {
    const { fetch, calls } = tokenEndpoint(() =>
      Response.json({
        access_token: tokenWithRoles(["skymail:access", "skymail:lists:read"]),
        refresh_token: "refresh-2",
        id_token: "id-2",
        expires_in: 300,
      }),
    );

    const next = await refreshIfExpiring(signedIn({ expiresAt: NOW + 30_000 }), options(fetch));

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${ISSUER}/protocol/openid-connect/token`);
    assert.equal(calls[0].body.get("grant_type"), "refresh_token");
    assert.equal(calls[0].body.get("refresh_token"), "refresh-1");
    assert.equal(calls[0].body.get("client_id"), CLIENT_ID);
    assert.equal(calls[0].body.has("client_secret"), false);
    assert.equal(calls[0].headers.has("Authorization"), false);

    assert.equal(next.refreshToken, "refresh-2");
    assert.equal(next.idToken, "id-2");
    assert.equal(next.expiresAt, NOW + 300_000);
    assert.deepEqual(next.roles, ["skymail:access", "skymail:lists:read"]);
    assert.equal(next.error, undefined);
  });

  it("keeps the refresh token when Keycloak does not rotate it", async () => {
    const { fetch } = tokenEndpoint(() =>
      Response.json({ access_token: tokenWithRoles(["skymail:access"]), expires_in: 300 }),
    );

    const next = await refreshIfExpiring(signedIn({ expiresAt: NOW - 1 }), options(fetch));

    assert.equal(next.refreshToken, "refresh-1");
    assert.equal(next.idToken, "id-1");
  });

  it("flags the session when Keycloak refuses the refresh", async () => {
    const { fetch } = tokenEndpoint(() =>
      Response.json({ error: "invalid_grant", error_description: "Session not active" }, { status: 400 }),
    );
    const token = signedIn({ expiresAt: NOW - 1 });

    const next = await refreshIfExpiring(token, options(fetch));

    assert.equal(next.error, "RefreshAccessTokenError");
    assert.equal(next.accessToken, token.accessToken);
  });

  it("flags the session when Keycloak cannot be reached", async () => {
    const { fetch } = tokenEndpoint(() => {
      throw new TypeError("fetch failed");
    });

    const next = await refreshIfExpiring(signedIn({ expiresAt: NOW - 1 }), options(fetch));

    assert.equal(next.error, "RefreshAccessTokenError");
  });

  // A refused refresh may be a blip (a network hiccup, two tabs refreshing at
  // once), so the next read tries again, and a success clears the flag.
  it("tries again on the next read and clears the flag when it works", async () => {
    const { fetch, calls } = tokenEndpoint(() =>
      Response.json({ access_token: tokenWithRoles(["skymail:access"]), expires_in: 300 }),
    );

    const next = await refreshIfExpiring(
      signedIn({ expiresAt: NOW - 1, error: "RefreshAccessTokenError" }),
      options(fetch),
    );

    assert.equal(calls.length, 1);
    assert.equal(next.error, undefined);
  });
});

// A page load sends several requests at once — the page, the sidebar's
// prefetches, other tabs — and each runs the jwt callback. Whether or not the
// realm revokes a used refresh token, they should not all go to Keycloak, and
// if it does, the losers must not come back holding a spent token.
describe("reads that need a refresh at the same moment", () => {
  function gatedTokenEndpoint() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let issued = 0;
    const endpoint = tokenEndpoint(async () => {
      issued += 1;
      await gate;
      return Response.json({
        access_token: tokenWithRoles(["skymail:access"]),
        refresh_token: `refresh-rotated-${issued}`,
        expires_in: 300,
      });
    });
    return { ...endpoint, release };
  }

  it("share one refresh", async () => {
    const { fetch, calls, release } = gatedTokenEndpoint();
    const shared = { ...options(fetch) };
    const expiring = signedIn({ expiresAt: NOW + 30_000 });

    const pending = [refreshIfExpiring(expiring, shared), refreshIfExpiring(expiring, shared)];
    release();
    const [first, second] = await Promise.all(pending);

    assert.equal(calls.length, 1);
    assert.equal(first.refreshToken, "refresh-rotated-1");
    assert.equal(second.refreshToken, "refresh-rotated-1");
    assert.equal(first.accessToken, second.accessToken);
  });

  it("hand the fresh token to a read that arrives shortly after with the spent one", async () => {
    const { fetch, calls, release } = gatedTokenEndpoint();
    release();
    let now = NOW;
    const shared = options(fetch, () => now);
    const expiring = signedIn({ expiresAt: NOW + 30_000 });

    const first = await refreshIfExpiring(expiring, shared);
    now += 5_000; // a request the browser sent before the new cookie arrived
    const late = await refreshIfExpiring(expiring, shared);

    assert.equal(calls.length, 1);
    assert.equal(late.refreshToken, first.refreshToken);
    // The expiry counts from when Keycloak issued the token, not from the late read.
    assert.equal(late.expiresAt, first.expiresAt);
  });

  it("go back to Keycloak once the shared result is old", async () => {
    const { fetch, calls, release } = gatedTokenEndpoint();
    release();
    let now = NOW;
    const shared = options(fetch, () => now);
    const expiring = signedIn({ expiresAt: NOW + 30_000 });

    await refreshIfExpiring(expiring, shared);
    now += 10 * 60_000;
    await refreshIfExpiring({ ...expiring, expiresAt: now }, shared);

    assert.equal(calls.length, 2);
  });
});

describe("a refused refresh", () => {
  // The refresh runs a minute before expiry. If Keycloak refuses it then —
  // a spent refresh token, a blip — the access token still works, and flagging
  // the session would log the operator out while it is valid.
  it("keeps a token that still has time left, unflagged", async () => {
    const { fetch } = tokenEndpoint(() =>
      Response.json({ error: "invalid_grant", error_description: "Stale token" }, { status: 400 }),
    );
    const token = signedIn({ expiresAt: NOW + 30_000 });

    const next = await refreshIfExpiring(token, options(fetch));

    assert.equal(next.error, undefined);
    assert.equal(next.accessToken, token.accessToken);
    assert.equal(next.refreshToken, token.refreshToken);
  });

  it("is tried again on the next read rather than remembered", async () => {
    let attempts = 0;
    const { fetch } = tokenEndpoint(() => {
      attempts += 1;
      return attempts === 1
        ? Response.json({ error: "temporarily_unavailable" }, { status: 503 })
        : Response.json({ access_token: tokenWithRoles(["skymail:access"]), expires_in: 300 });
    });
    const shared = options(fetch);
    const token = signedIn({ expiresAt: NOW + 30_000 });

    await refreshIfExpiring(token, shared);
    const next = await refreshIfExpiring(token, shared);

    assert.equal(attempts, 2);
    assert.equal(next.expiresAt, NOW + 300_000);
  });
});

// /api/auth/session answers the browser with this, and the HTTP client reads
// it on every request. The access token has to be there; the refresh token and
// the ID token must never be.
describe("the session the browser sees", () => {
  const token = signedIn({
    refreshToken: "secret-refresh-token",
    idToken: "secret-id-token",
    roles: ["skymail:access", "skymail:lists:read"],
    user: { name: "Ada Lovelace", email: "ada@example.test" },
  });
  const expires = "2026-10-23T00:00:00.000Z";

  it("carries the access token, the roles and the person", () => {
    const session = sessionFromToken({ expires }, token);

    assert.equal(session.accessToken, token.accessToken);
    assert.deepEqual(session.roles, ["skymail:access", "skymail:lists:read"]);
    assert.equal(session.user.name, "Ada Lovelace");
    assert.equal(session.user.email, "ada@example.test");
    assert.equal(session.expires, expires);
    assert.equal(session.error, undefined);
  });

  it("never carries the refresh token or the ID token", () => {
    const exposed = JSON.stringify(sessionFromToken({ expires }, token));

    assert.equal(exposed.includes("secret-refresh-token"), false);
    assert.equal(exposed.includes("secret-id-token"), false);
    assert.equal(/refresh|idToken/i.test(exposed), false);
  });

  it("carries the refresh-error flag so the panel can offer a re-login", () => {
    const session = sessionFromToken({ expires }, { ...token, error: "RefreshAccessTokenError" });

    assert.equal(session.error, "RefreshAccessTokenError");
  });
});

// The API records who wrote a Mail template version by the token's subject;
// the panel compares it with the viewer's to tell their own draft apart. It
// is read once, with the roles, not on every page.
describe("who the session belongs to", () => {
  const signIn = (access_token: string) =>
    tokenFromSignIn({ access_token, expires_at: NOW / 1000 + 300 }, { clientId: CLIENT_ID, profile: {} });

  it("is the access token's subject, kept at sign-in", () => {
    assert.equal(signIn(tokenWithRoles(["skymail:access"])).subject, "user-1");
  });

  it("is unknown when the token carries no usable subject", () => {
    assert.equal(signIn(accessToken({ resource_access: {} })).subject, null);
    assert.equal(signIn(accessToken({ sub: "" })).subject, null);
    assert.equal(signIn(accessToken({ sub: 42 })).subject, null);
    assert.equal(signIn("not-a-jwt").subject, null);
  });

  // A cookie written before the subject was kept gets it with its next token.
  it("is read again from a refreshed token", async () => {
    const { fetch } = tokenEndpoint(() =>
      Response.json({ access_token: tokenWithRoles(["skymail:access"]), expires_in: 300 }),
    );
    const older = signedIn({ expiresAt: NOW + 30_000 });
    delete older.subject;

    const next = await refreshIfExpiring(older, options(fetch));

    assert.equal(next.subject, "user-1");
  });

  it("reaches the browser with the person", () => {
    const expires = "2026-10-23T00:00:00.000Z";

    assert.equal(sessionFromToken({ expires }, signedIn({ subject: "user-1" })).subject, "user-1");
    assert.equal(sessionFromToken({ expires }, signedIn({ subject: null })).subject, null);
  });
});
