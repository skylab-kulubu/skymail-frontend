/**
 * A signed-in operator without Keycloak: the Auth.js session cookie, minted
 * and encrypted with the test server's AUTH_SECRET (env.ts), holding what
 * src/lib/auth/session-token.ts keeps after a real sign-in. Its access token
 * is unsigned — the panel only reads its roles and subject, and the API that
 * would verify it is the mock, which accepts exactly this token.
 */
import { decode, encode } from "next-auth/jwt";
import { E2E_AUTH_SECRET, E2E_BASE_URL } from "./env";

export const VIEWER = {
  sub: "8d0f5c2e-6b1a-4c3e-9f27-5a1d3b7e9c41",
  name: "DENEME OPERATÖR",
  email: "operator@example.test",
} as const;

export const ROLES = {
  writer: ["skymail:access", "skymail:templates:read", "skymail:templates:write"],
  reader: ["skymail:access", "skymail:templates:read"],
  /** Sends to lists and people, and reads sends and lists (ticket 16). */
  sender: ["skymail:access", "skymail:templates:read", "skymail:lists:read", "skymail:mails:read", "skymail:mails:write"],
  /** Sends to people only (`mails:send`), and reads nothing of sends. */
  individual: ["skymail:access", "skymail:templates:read", "skymail:mails:send"],
  /** Reads sends, sends nothing. */
  watcher: ["skymail:access", "skymail:templates:read", "skymail:mails:read"],
} as const;

export type Profile = keyof typeof ROLES;

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** The bearer token the panel sends for `profile`; the mock API accepts these and nothing else. */
export function accessToken(profile: Profile): string {
  const claims = { sub: VIEWER.sub, resource_access: { skymail: { roles: ROLES[profile] } } };
  return `${base64url({ alg: "none", typ: "JWT" })}.${base64url(claims)}.`;
}

export const SESSION_COOKIE = "authjs.session-token";

export async function sessionCookie(profile: Profile) {
  const value = await encode({
    secret: E2E_AUTH_SECRET,
    salt: SESSION_COOKIE,
    token: {
      accessToken: accessToken(profile),
      refreshToken: "not-a-refresh-token",
      expiresAt: Date.now() + 24 * 3600_000,
      roles: [...ROLES[profile]],
      subject: VIEWER.sub,
      user: { name: VIEWER.name, email: VIEWER.email },
    },
  });
  return {
    name: SESSION_COOKIE,
    value,
    url: E2E_BASE_URL,
    httpOnly: true,
    sameSite: "Lax" as const,
  };
}

/** What a session cookie holds, or null when it is not one this server could have written. */
export function readSession(value: string) {
  return decode({ token: value, secret: E2E_AUTH_SECRET, salt: SESSION_COOKIE }).catch(() => null);
}
