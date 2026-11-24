/**
 * The console's Content-Security-Policy, built per request by the proxy
 * (src/proxy.ts) around a fresh nonce: Account Center's pattern
 * (account-center src/proxy.ts), with what İletişim needs besides.
 *
 * Scripts run only with the nonce, and what they load ('strict-dynamic'):
 * Next.js puts the nonce on its own scripts once it finds it in the request's
 * policy header, the root layout on the theme scripts, and Monaco's AMD loader
 * is loaded by a script that has it.
 *
 * Two departures from Account Center, both for the mail previews:
 *
 *  - Styles may be inline ('unsafe-inline', no nonce). A preview frame is an
 *    `srcdoc` document, and such a document inherits this policy on top of
 *    its own: a mail's <style> blocks carry no nonce and would be dropped.
 *    Monaco and the visual editor (Tiptap) add <style> elements of their own
 *    without one too. Scripts stay under the nonce, which is what stops an
 *    injected script.
 *  - Images and fonts may come over https from anywhere: a preview shows a
 *    template's images, and a sent mail's once the operator asks for them
 *    (src/components/mail-preview/preview-document.ts keeps them off until
 *    then with a policy of its own).
 *
 * Until `CSP_MODE=enforce` the policy is sent as
 * Content-Security-Policy-Report-Only: the browser reports what it would
 * block in its console and blocks nothing. X-Frame-Options (next.config.ts)
 * keeps the console out of other sites' frames either way.
 *
 * /render-sandbox keeps its own policy (`sandbox allow-scripts`,
 * next.config.ts); the proxy never runs there.
 */

export type CspMode = "report-only" | "enforce";

/** The environment variable that turns the policy from reporting into blocking. */
export const CSP_MODE_ENV = "CSP_MODE";

/** `enforce` blocks; anything else, unset included, only reports. */
export function cspMode(value: string | undefined): CspMode {
  return value?.trim().toLowerCase() === "enforce" ? "enforce" : "report-only";
}

/** The header the policy goes out in for `mode`. */
export function cspHeaderName(mode: CspMode): string {
  return mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

/** Both names, so a policy a client sent along never reaches Next.js beside ours. */
export const CSP_HEADER_NAMES = ["Content-Security-Policy", "Content-Security-Policy-Report-Only"] as const;

/** A nonce for one response, as Account Center makes it. */
export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/** The origin of an absolute http(s) URL; null for anything else, so a bad setting adds nothing to the policy. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export type PolicyInput = Readonly<{
  nonce: string;
  mode: CspMode;
  /** `next dev`: React needs eval and the dev server a websocket. */
  development: boolean;
  /** Whether the page was asked for over https (behind the edge, AUTH_URL's scheme). */
  https: boolean;
  /** The SkyMail API the browser calls (API_URL). */
  apiUrl?: string;
  /** The Keycloak realm sign-in and sign-out go to (KEYCLOAK_ISSUER). */
  issuer?: string;
}>;

export function contentSecurityPolicy({ nonce, mode, development, https, apiUrl, issuer }: PolicyInput): string {
  const api = originOf(apiUrl);
  const keycloak = originOf(issuer);
  const sources = (...list: (string | null | false)[]) => list.filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    sources("script-src 'self'", `'nonce-${nonce}'`, "'strict-dynamic'", development && "'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    sources("connect-src 'self'", api, development && "ws:"),
    // Monaco's language workers; the render sandbox's worker runs under the sandbox's own policy.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    sources("form-action 'self'", keycloak),
    "frame-ancestors 'none'",
    // A report-only policy cannot upgrade anything; the browser would only warn that it ignores it.
    ...(https && !development && mode === "enforce" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
