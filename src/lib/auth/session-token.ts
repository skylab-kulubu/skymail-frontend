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

/**
 * The Keycloak subject the access token was issued to, read like the roles.
 * skymail-backend records it as the author of a Mail template version, so the
 * panel tells the viewer's own draft apart by it.
 */
export function tokenSubject(accessToken: string): string | null {
  const sub = claims(accessToken).sub;
  return typeof sub === "string" && sub !== "" ? sub : null;
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

/** A token endpoint answer, with when it arrived. */
type Issued = { tokens: TokenResponse; receivedAt: number };

/** How long a refresh result is handed to reads still carrying the refresh token it replaced. */
const SHARED_RESULT_MS = 30_000;

/**
 * Refreshes in flight, and those that finished moments ago, by the refresh
 * token they spent.
 *
 * One page load runs the jwt callback several times at once — the page, the
 * sidebar's prefetches, /api/auth/session from the HTTP client, other tabs —
 * and a request the browser sent before the new cookie arrived still carries
 * the old refresh token. They all get one refresh's result instead of each
 * going to Keycloak.
 *
 * This matters most if the realm revokes a refresh token once it is used
 * ("Revoke Refresh Token"): then every read but the first would be refused.
 * e-skylab-keycloak's reconcile scripts do not set revokeRefreshToken, so
 * the realm should be on Keycloak's default (off, a used refresh token keeps
 * working until the SSO session ends) — but the realm is partly managed by
 * hand, so this does not rely on it. The store lives in one server process;
 * the image runs one.
 */
export type RefreshStore = {
  run(refreshToken: string, attempt: () => Promise<Issued | null>, now: () => number): Promise<Issued | null>;
};

export function createRefreshStore(): RefreshStore {
  const entries = new Map<string, { result: Promise<Issued | null>; staleAt: number | null }>();

  return {
    run(refreshToken, attempt, now) {
      for (const [key, entry] of entries) {
        if (entry.staleAt !== null && entry.staleAt <= now()) entries.delete(key);
      }
      const existing = entries.get(refreshToken);
      if (existing) return existing.result;

      const entry: { result: Promise<Issued | null>; staleAt: number | null } = {
        result: attempt().then((issued) => {
          // A refusal is not remembered: the next read tries again.
          if (issued) entry.staleAt = now() + SHARED_RESULT_MS;
          else entries.delete(refreshToken);
          return issued;
        }),
        staleAt: null,
      };
      entries.set(refreshToken, entry);
      return entry.result;
    },
  };
}

const processStore = createRefreshStore();

export type RefreshOptions = {
  /** The realm URL, e.g. `https://e.yildizskylab.com/realms/e-skylab`. */
  issuer: string;
  clientId: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  /** Defaults to one store for the whole server process. */
  store?: RefreshStore;
};

async function requestTokens(
  refreshToken: string,
  { issuer, clientId, fetch, now }: Required<Omit<RefreshOptions, "store">>,
): Promise<Issued | null> {
  try {
    // A public client authenticates with its client_id alone: no secret in the
    // body and no Basic header.
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!response.ok) return null;
    return { tokens: (await response.json()) as TokenResponse, receivedAt: now() };
  } catch {
    return null;
  }
}

/**
 * Returns the token unchanged while it has time left, and otherwise trades the
 * refresh token for a new one (shared with every read that needs the same
 * trade, see RefreshStore).
 *
 * A refusal does not throw. While the access token is still valid the token
 * comes back unchanged — flagging it would log out someone whose token still
 * works — and the next read tries again. Once it has expired the token comes
 * back flagged and the panel offers a re-login. The flag does not stick
 * either: a later successful refresh clears it.
 */
export async function refreshIfExpiring(
  token: SessionToken,
  { issuer, clientId, fetch = globalThis.fetch, now = Date.now, store = processStore }: RefreshOptions,
): Promise<SessionToken> {
  if (now() < token.expiresAt - EXPIRY_MARGIN_MS) return token;

  const issued = token.refreshToken
    ? await store.run(token.refreshToken, () => requestTokens(token.refreshToken!, { issuer, clientId, fetch, now }), now)
    : null;

  if (!issued) {
    return now() < token.expiresAt ? token : { ...token, error: REFRESH_ERROR };
  }

  const { tokens, receivedAt } = issued;
  return {
    ...token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? token.refreshToken,
    idToken: tokens.id_token ?? token.idToken,
    expiresAt: receivedAt + (tokens.expires_in ?? DEFAULT_LIFETIME_S) * 1000,
    roles: clientRoles(tokens.access_token, clientId),
    error: undefined,
  };
}


/** What /api/auth/session gives the browser. */
export type ExposedSession = {
  expires: string;
  user: { name?: string | null; email?: string | null };
  /** Sent as the bearer token to the SkyMail API. */
  accessToken: string;
  /** The `skymail` client roles. */
  roles: string[];
  /** Set once Keycloak refused to refresh an expired token. */
  error?: typeof REFRESH_ERROR;
};

/**
 * The session Auth.js hands the browser, built field by field from the
 * cookie's token so nothing is exposed by accident: never the refresh token
 * or the ID token, which only the server needs.
 */
export function sessionFromToken(session: { expires: string }, token: SessionToken): ExposedSession {
  const exposed: ExposedSession = {
    expires: session.expires,
    user: { name: token.user?.name ?? null, email: token.user?.email ?? null },
    accessToken: token.accessToken,
    roles: token.roles ?? [],
  };
  if (token.error) exposed.error = token.error;
  return exposed;
}
