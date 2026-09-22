/**
 * The session token is what Auth.js keeps in its encrypted cookie between
 * requests. These tests drive the two moments that shape it — signing in and
 * reading a session whose access token is about to expire — with Keycloak's
 * token endpoint replaced by a fetch double.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refreshIfExpiring, tokenFromSignIn, type SessionToken } from "./session-token";

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

function signedIn(overrides: Partial<SessionToken> = {}): SessionToken {
  return {
    accessToken: tokenWithRoles(["skymail:access"]),
    refreshToken: "refresh-1",
    idToken: "id-1",
    expiresAt: NOW + 10 * 60_000,
    roles: ["skymail:access"],
    user: { name: "Ada Lovelace" },
    ...overrides,
  };
}

describe("reading the session", () => {
  it("leaves a token with time left on it alone", async () => {
    const { fetch, calls } = tokenEndpoint(() => assert.fail("no refresh expected"));
    const token = signedIn();

    const next = await refreshIfExpiring(token, { issuer: ISSUER, clientId: CLIENT_ID, fetch, now: () => NOW });

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

    const next = await refreshIfExpiring(signedIn({ expiresAt: NOW + 30_000 }), {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      fetch,
      now: () => NOW,
    });

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

    const next = await refreshIfExpiring(signedIn({ expiresAt: NOW - 1 }), {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      fetch,
      now: () => NOW,
    });

    assert.equal(next.refreshToken, "refresh-1");
    assert.equal(next.idToken, "id-1");
  });

  it("flags the session when Keycloak refuses the refresh", async () => {
    const { fetch } = tokenEndpoint(() =>
      Response.json({ error: "invalid_grant", error_description: "Session not active" }, { status: 400 }),
    );
    const token = signedIn({ expiresAt: NOW - 1 });

    const next = await refreshIfExpiring(token, { issuer: ISSUER, clientId: CLIENT_ID, fetch, now: () => NOW });

    assert.equal(next.error, "RefreshAccessTokenError");
    assert.equal(next.accessToken, token.accessToken);
  });

  it("flags the session when Keycloak cannot be reached", async () => {
    const { fetch } = tokenEndpoint(() => {
      throw new TypeError("fetch failed");
    });

    const next = await refreshIfExpiring(signedIn({ expiresAt: NOW - 1 }), {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      fetch,
      now: () => NOW,
    });

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
      { issuer: ISSUER, clientId: CLIENT_ID, fetch, now: () => NOW },
    );

    assert.equal(calls.length, 1);
    assert.equal(next.error, undefined);
  });
});
