/**
 * What Auth.js keeps in its encrypted session cookie, and how it is kept fresh.
 *
 * SkyMail signs in through Keycloak's `skymail` client — the same public client
 * the Refine app used — so the access token carries the same audience and the
 * same `resource_access.skymail.roles` the API already checks. The panel reads
 * its roles from there too.
 */

export const REFRESH_ERROR = "RefreshAccessTokenError";

export type SessionUser = { name?: string; email?: string };

export type SessionToken = {
  accessToken: string;
  refreshToken?: string;
  /** Kept for `id_token_hint` when signing out of Keycloak. */
  idToken?: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** The `skymail` client roles, e.g. `skymail:access`, `skymail:templates:read`. */
  roles: string[];
  user: SessionUser;
  error?: typeof REFRESH_ERROR;
};

/** The fields of an Auth.js `Account` this module reads. */
export type SignInAccount = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  /** Epoch seconds. */
  expires_at?: number;
  expires_in?: number;
};

/** A token endpoint answer (RFC 6749 §5.1). */
type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
};

/** Refresh this long before the access token expires, so a request never leaves with one that dies in flight. */
const EXPIRY_MARGIN_MS = 60_000;

const DEFAULT_LIFETIME_S = 300;

function claims(accessToken: string): Record<string, unknown> {
  try {
    const payload = accessToken.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(json, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * The roles Keycloak granted this client, read without verifying the token:
 * it came straight from Keycloak's token endpoint over TLS, and the API
 * verifies it again on every call.
 */
export function clientRoles(accessToken: string, clientId: string): string[] {
  const access = claims(accessToken).resource_access as
    | Record<string, { roles?: unknown }>
    | undefined;
  const roles = access?.[clientId]?.roles;
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
}

function pickUser(profile: { name?: unknown; email?: unknown }): SessionUser {
  const user: SessionUser = {};
  if (typeof profile.name === "string" && profile.name !== "") user.name = profile.name;
  if (typeof profile.email === "string" && profile.email !== "") user.email = profile.email;
  return user;
}

export function tokenFromSignIn(
  account: SignInAccount,
  { clientId, profile }: { clientId: string; profile: { name?: unknown; email?: unknown } },
): SessionToken {
  const accessToken = account.access_token ?? "";
  const expiresAt =
    account.expires_at !== undefined
      ? account.expires_at * 1000
      : Date.now() + (account.expires_in ?? DEFAULT_LIFETIME_S) * 1000;

  return {
    accessToken,
    refreshToken: account.refresh_token,
    idToken: account.id_token,
    expiresAt,
    roles: clientRoles(accessToken, clientId),
    user: pickUser(profile),
  };
}

export type RefreshOptions = {
  /** The realm URL, e.g. `https://e.yildizskylab.com/realms/e-skylab`. */
  issuer: string;
  clientId: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
};

/**
 * Returns the token unchanged while it has time left, and otherwise trades the
 * refresh token for a new one. A refusal does not throw: the token comes back
 * flagged, the panel offers a re-login, and the next read tries again — a
 * refusal can be a blip, and a flag that stuck would log out someone whose
 * session is still alive.
 */
export async function refreshIfExpiring(
  token: SessionToken,
  { issuer, clientId, fetch = globalThis.fetch, now = Date.now }: RefreshOptions,
): Promise<SessionToken> {
  if (now() < token.expiresAt - EXPIRY_MARGIN_MS) return token;
  if (!token.refreshToken) return { ...token, error: REFRESH_ERROR };

  try {
    // A public client authenticates with its client_id alone: no secret in the
    // body and no Basic header.
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: token.refreshToken,
      }).toString(),
    });
    if (!response.ok) return { ...token, error: REFRESH_ERROR };

    const fresh = (await response.json()) as TokenResponse;
    return {
      ...token,
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token ?? token.refreshToken,
      idToken: fresh.id_token ?? token.idToken,
      expiresAt: now() + (fresh.expires_in ?? DEFAULT_LIFETIME_S) * 1000,
      roles: clientRoles(fresh.access_token, clientId),
      error: undefined,
    };
  } catch {
    return { ...token, error: REFRESH_ERROR };
  }
}
