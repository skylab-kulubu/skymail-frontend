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
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|skylab.svg).*)"],
};
