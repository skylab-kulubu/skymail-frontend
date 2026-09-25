/**
 * Auth.js v5 with Keycloak's existing `skymail` client.
 *
 * The client is public — the Refine app signed in with keycloak-js — so no
 * secret is sent to the token endpoint, and PKCE plus `state` protect the
 * code exchange. Auth.js only enables PKCE by default, so `state` is asked for
 * explicitly. `AUTH_SECRET` encrypts Auth.js's own session cookie and is never
 * shown to Keycloak.
 *
 * The configuration is built per request so that the image carries no
 * environment: sandbox and production differ only in the variables Dokploy
 * passes to the container.
 */
import "server-only";
import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import {
  refreshIfExpiring,
  sessionFromToken,
  tokenFromSignIn,
  type ExposedSession,
  type SessionToken,
} from "@/lib/auth/session-token";
import { keycloakSettings } from "@/lib/runtime-config";

declare module "next-auth" {
  // What /api/auth/session gives the browser: built by sessionFromToken.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the augmentation is the shape itself
  interface Session extends ExposedSession {}
}

declare module "next-auth/jwt" {
  // What the encrypted session cookie holds once someone has signed in. The
  // token Auth.js passes the jwt callback on sign-in itself does not have
  // these fields yet; that call ignores it and builds one from the account.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the augmentation is the shape itself
  interface JWT extends SessionToken {}
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const { issuer, clientId } = keycloakSettings();

  return {
    providers: [
      Keycloak({
        issuer,
        clientId,
        client: { token_endpoint_auth_method: "none" },
        checks: ["pkce", "state"],
      }),
    ],
    session: { strategy: "jwt" },
    pages: { signIn: "/login", error: "/login" },
    callbacks: {
      /**
       * The proxy's rule: every page but `/login` needs a live session. A
       * visitor without one — or whose token Keycloak refused to refresh —
       * goes to `/login`, which brings them back to the address they asked for.
       */
      authorized({ request, auth: session }) {
        const { pathname, search } = request.nextUrl;
        if (pathname === "/login") return true;
        if (session && !session.error) return true;

        const login = new URL("/login", request.nextUrl);
        login.searchParams.set("callbackUrl", `${pathname}${search}`);
        if (session?.error) login.searchParams.set("error", "SessionExpired");
        return NextResponse.redirect(login);
      },
      async jwt({ token, account, profile }) {
        if (account) return tokenFromSignIn(account, { clientId, profile: profile ?? {} });
        return refreshIfExpiring(token, { issuer, clientId });
      },
      // What reaches the browser: never the refresh or ID token.
      async session({ session, token }) {
        return sessionFromToken(session, token);
      },
    },
  };
});
