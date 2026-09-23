/**
 * A signed-in operator without Keycloak: the Auth.js session cookie, minted
 * and encrypted with the test server's AUTH_SECRET (env.ts), holding what
 * src/lib/auth/session-token.ts keeps after a real sign-in. Its access token
 * is unsigned — the panel only reads its roles and subject, and the API that
 * would verify it is the mock, which accepts exactly this token.
 */
import { decode, encode } from "next-auth/jwt";
import { E2E_AUTH_SECRET, E2E_BASE_URL } from "./env";

export type Person = Readonly<{ sub: string; name: string; email: string }>;

export const VIEWER: Person = {
  sub: "8d0f5c2e-6b1a-4c3e-9f27-5a1d3b7e9c41",
  name: "DENEME OPERATÖR",
  email: "operator@example.test",
};

/** A club member who sends nothing and submits for approval (ticket 20). */
export const MEMBER: Person = {
  sub: "4c2a9e17-5b3d-4f60-8a21-7e9d0c3b5f12",
  name: "Ayşe Yılmaz",
  email: "ayse.yilmaz@example.test",
};

/** An approver (skymail:mails:approve), someone other than the member. */
export const APPROVER: Person = {
  sub: "6f3b8d21-9a4c-4e7f-b2d0-3c8e5a1f7b64",
  name: "Zeynep Arslan",
  email: "zeynep.arslan@example.test",
};

export const ROLES = {
  writer: ["skymail:access", "skymail:templates:read", "skymail:templates:write"],
  reader: ["skymail:access", "skymail:templates:read"],
  /** Sends to lists and people, and reads sends and lists (ticket 16). */
  sender: ["skymail:access", "skymail:templates:read", "skymail:lists:read", "skymail:mails:read", "skymail:mails:write"],
  /** Sends to people only (`mails:send`), and reads nothing of sends. */
  individual: ["skymail:access", "skymail:templates:read", "skymail:mails:send"],
  /** Sends to people only (`mails:send`) and reads lists: a list goes for approval (ticket 20). */
  personSender: ["skymail:access", "skymail:templates:read", "skymail:lists:read", "skymail:mails:send"],
  /** Reads sends, sends nothing. */
  watcher: ["skymail:access", "skymail:templates:read", "skymail:mails:read"],
  /** Reads templates and lists and sends nothing: submits for approval (ticket 20). */
  member: ["skymail:access", "skymail:templates:read", "skymail:lists:read"],
  /** Decides sends submitted for approval; reads templates and sends, sends nothing itself. */
  approver: ["skymail:access", "skymail:templates:read", "skymail:mails:read", "skymail:mails:approve"],
} as const;

export type Profile = keyof typeof ROLES;

/** Who a profile signs in as: the member and the approver are people of their own, everyone else the operator. */
export function personOf(profile: Profile): Person {
  return profile === "member" ? MEMBER : profile === "approver" ? APPROVER : VIEWER;
}

const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** The bearer token the panel sends for `profile`; the mock API accepts these and nothing else. */
export function accessToken(profile: Profile): string {
  const claims = { sub: personOf(profile).sub, resource_access: { skymail: { roles: ROLES[profile] } } };
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
      subject: personOf(profile).sub,
      user: { name: personOf(profile).name, email: personOf(profile).email },
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
