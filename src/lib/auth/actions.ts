"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getToken } from "next-auth/jwt";
import { signIn, signOut } from "@/auth";
import { safeCallbackPath } from "@/lib/auth/redirect";
import type { SessionToken } from "@/lib/auth/session-token";
import { keycloakSettings } from "@/lib/runtime-config";

/** Sends the browser to Keycloak's login, coming back to `callbackUrl`. */
export async function signInWithKeycloak(formData: FormData): Promise<void> {
  await signIn("keycloak", { redirectTo: safeCallbackPath(formData.get("callbackUrl")) });
}

async function appOrigin(): Promise<string> {
  const configured = process.env.AUTH_URL?.trim();
  if (configured) return new URL(configured).origin;
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Ends both sessions: Auth.js's cookie here, then Keycloak's single sign-on
 * session, which would otherwise sign the next "Giriş yap" straight back in
 * as the same person. Keycloak returns to this site's origin — the address
 * the Refine app already used — so no new logout address is needed.
 */
export async function signOutOfKeycloak(): Promise<void> {
  const cookieStore = await cookies();
  const secureCookie = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith("__Secure-authjs.session-token"));
  const token = (await getToken({
    req: { headers: await headers() },
    secret: process.env.AUTH_SECRET,
    secureCookie,
  })) as Partial<SessionToken> | null;

  await signOut({ redirect: false });

  const { issuer, clientId } = keycloakSettings();
  const logout = new URL(`${issuer}/protocol/openid-connect/logout`);
  logout.searchParams.set("client_id", clientId);
  logout.searchParams.set("post_logout_redirect_uri", await appOrigin());
  if (token?.idToken) logout.searchParams.set("id_token_hint", token.idToken);
  redirect(logout.toString());
}
