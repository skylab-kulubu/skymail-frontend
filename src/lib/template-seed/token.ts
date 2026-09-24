/**
 * The bearer token the Template seed writes with: one handed over ready, or a
 * client-credentials token from Keycloak.
 *
 * skymail-backend checks every token by asking Keycloak's userinfo, and
 * Keycloak answers userinfo only for a token that carries the openid scope. A
 * client-credentials token has none unless it asks, so without the scope a
 * service account's token is issued fine and then refused by SkyMail as
 * server.unauthorized. A person's token from a browser sign-in always has it,
 * which is why seeding with SKYMAIL_TOKEN never showed the gap.
 */

/**
 * The environment the seed reads its credentials from (process.env): SKYMAIL_TOKEN,
 * or KEYCLOAK_TOKEN_URL + KEYCLOAK_CLIENT_ID + KEYCLOAK_CLIENT_SECRET. Never printed.
 */
export type SeedCredentials = Readonly<Record<string, string | undefined>>;

export async function seedToken(env: SeedCredentials, fetch: typeof globalThis.fetch): Promise<string> {
  if (env.SKYMAIL_TOKEN) {
    return env.SKYMAIL_TOKEN;
  }

  const { KEYCLOAK_TOKEN_URL: tokenUrl, KEYCLOAK_CLIENT_ID: clientId, KEYCLOAK_CLIENT_SECRET: clientSecret } = env;
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      "Kimlik yok: ya SKYMAIL_TOKEN ver ya da KEYCLOAK_TOKEN_URL + KEYCLOAK_CLIENT_ID + KEYCLOAK_CLIENT_SECRET ver.",
    );
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid",
    }).toString(),
  });

  if (!response.ok) {
    // The body can carry the client secret back in an error description.
    throw new Error(`Keycloak token alınamadı: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Keycloak yanıtında access_token yok.");
  }
  return payload.access_token;
}
