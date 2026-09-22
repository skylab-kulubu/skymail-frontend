/**
 * Where to send someone after signing in: only a path on this site, so a
 * crafted `callbackUrl` cannot turn the sign-in into an open redirect.
 */
export function safeCallbackPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}
