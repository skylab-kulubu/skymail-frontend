/**
 * Where to send someone after signing in: only a path on this site, so a
 * crafted `callbackUrl` cannot turn the sign-in into an open redirect.
 *
 * Prefix checks alone are not enough: `/\t/evil.example` does not start with
 * `//`, yet a browser drops the tab from a Location header and follows
 * `//evil.example`. So control characters and backslashes are refused
 * outright, and what is left is parsed against a placeholder origin and kept
 * only if it stayed there.
 */
const PLACEHOLDER_ORIGIN = "http://skymail.invalid";

/** Tab, newline and the other C0 controls, DEL, and the backslash browsers read as "/". */
function hasUnsafeCharacter(raw: string): boolean {
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

export function safeCallbackPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || hasUnsafeCharacter(raw)) return "/";

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
