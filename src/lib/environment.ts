/**
 * Whether this server talks to the sandbox, read from the SkyNotify API address
 * as the admin panel reads its core address (core-frontend
 * src/lib/environment.ts): sandbox-api.… in the sandbox, and locally `yarn
 * dev` forwards /sandbox-api/*. The image is the same for both; the address
 * comes from API_URL at runtime (src/lib/runtime-config.ts).
 */
export function isSandbox(apiUrl: string): boolean {
  try {
    const url = new URL(apiUrl);
    return /^sandbox[-.]/.test(url.hostname) || url.pathname.startsWith("/sandbox-api");
  } catch {
    return false;
  }
}
