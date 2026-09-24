/**
 * Every page but the sign-in screen needs a live session; the rule itself is
 * the `authorized` callback in src/auth.ts. Running it here also lets Auth.js
 * write a refreshed token back to the session cookie on navigation.
 *
 * Exported as `auth` itself: with a per-request config, `auth(handler)`
 * returns a promise rather than a function, which Next.js rejects as a proxy.
 */
export { auth as proxy } from "@/auth";

export const config = {
  // The Mail template editor's static assets (scripts/build-editor-assets.ts)
  // hold nothing of anyone's, and the render sandbox requests its script from
  // an opaque origin, without the session cookie, so they pass unchecked.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|skylab.svg|render-sandbox/|monaco/).*)"],
};
