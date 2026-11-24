/**
 * Every page but the sign-in screen needs a live session; the rule itself is
 * the `authorized` callback in src/auth.ts. Running it here also lets Auth.js
 * write a refreshed token back to the session cookie on navigation.
 *
 * A request it lets through gets the console's Content-Security-Policy
 * (src/lib/content-security-policy.ts) around a fresh nonce. The policy goes
 * to Next.js in the request's headers, so it puts the nonce on its own
 * scripts, and to the root layout as `x-nonce`; and to the browser in the
 * response's, as Content-Security-Policy-Report-Only until CSP_MODE=enforce.
 * A redirect to /login carries none: it has no content.
 */
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  contentSecurityPolicy,
  CSP_HEADER_NAMES,
  CSP_MODE_ENV,
  cspHeaderName,
  cspMode,
  newNonce,
} from "@/lib/content-security-policy";

type Proxy = (request: NextRequest, event: NextFetchEvent) => Promise<Response>;

function withContentSecurityPolicy(request: NextRequest): Response {
  const nonce = newNonce();
  const mode = cspMode(process.env[CSP_MODE_ENV]);
  const header = cspHeaderName(mode);
  const policy = contentSecurityPolicy({
    nonce,
    mode,
    development: process.env.NODE_ENV === "development",
    // Auth.js has already put AUTH_URL's origin on the request when it is set.
    https: request.nextUrl.protocol === "https:",
    apiUrl: process.env.API_URL,
    issuer: process.env.KEYCLOAK_ISSUER,
  });

  const headers = new Headers(request.headers);
  for (const name of CSP_HEADER_NAMES) headers.delete(name);
  headers.set(header, policy);
  headers.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set(header, policy);
  return response;
}

// With a per-request config (src/auth.ts), `auth(handler)` hands the wrapped
// handler back in a promise rather than as a function, which Next.js would
// reject as a proxy; resolved once here, it is called for every request.
const sessionThenPolicy = Promise.resolve(auth(withContentSecurityPolicy) as unknown as Proxy | Promise<Proxy>);

export async function proxy(request: NextRequest, event: NextFetchEvent): Promise<Response> {
  return (await sessionThenPolicy)(request, event);
}

export const config = {
  // The Mail template editor's static assets (scripts/build-editor-assets.ts)
  // hold nothing of anyone's, and the render sandbox requests its script from
  // an opaque origin, without the session cookie, so they pass unchecked.
  // The container health check (/api/health) has no session either. The two
  // logos in public/mail/ are what every sent mail shows (emails/theme.tsx):
  // a mail client fetches them with no session at all. Only those two names:
  // any other path under /mail/ is guarded like the rest of the console.
  matcher: ["/((?!api/auth|api/health$|_next/static|_next/image|favicon.ico|skylab.svg|mail/skylab-(?:ink|lilac)\\.png$|render-sandbox/|monaco/).*)"],
};
