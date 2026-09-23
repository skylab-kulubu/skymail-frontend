/**
 * The browser tests' own server: a production build on its own port, with an
 * environment that reaches nothing real. Keycloak is never called (sessions
 * are minted, see session.ts) and the SkyMail API lives only in the browser,
 * answered at the network layer by mock-api.ts, on the panel's own origin so
 * no CORS preflight stands between a request and the mock.
 */
export const E2E_PORT = 3013;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_API_URL = `${E2E_BASE_URL}/e2e-api/v1`;

/** Encrypts the test sessions only; never used anywhere else. */
export const E2E_AUTH_SECRET = "skymail-e2e-only-throwaway-secret-0123456789";

export const E2E_SERVER_ENV: Record<string, string> = {
  AUTH_SECRET: E2E_AUTH_SECRET,
  AUTH_URL: E2E_BASE_URL,
  KEYCLOAK_ISSUER: "https://keycloak.e2e.invalid/realms/e2e",
  KEYCLOAK_CLIENT_ID: "skymail",
  API_URL: E2E_API_URL,
  NEXT_TELEMETRY_DISABLED: "1",
};
