import "server-only";

/**
 * Settings that differ between sandbox and production, read from the process
 * environment when a request arrives — never baked in at build time — so the
 * same image runs in both. Only server code imports this module; client
 * components receive `PublicConfig` as props from the root layout.
 */

export type ConsoleLink = Readonly<{ id: "admin" | "forms"; label: string; href: string }>;

/** What the browser needs to know, and nothing secret. */
export type PublicConfig = Readonly<{
  /** The SkyMail API base, e.g. `https://api.yildizskylab.com/api/skymail/v1`. */
  apiUrl: string;
  /** The other club consoles, for the club switcher. */
  consoles: readonly ConsoleLink[];
}>;

/** Variables the server cannot start a sign-in or call the API without. */
export const REQUIRED_ENV = ["AUTH_SECRET", "KEYCLOAK_ISSUER", "API_URL"] as const;

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function required(name: (typeof REQUIRED_ENV)[number]): string {
  const value = read(name);
  if (!value) throw new Error(`${name} is not set; see .env.example`);
  return value;
}

export function missingEnv(): string[] {
  const missing: string[] = REQUIRED_ENV.filter((name) => !read(name));
  // Behind Dokploy's proxy Auth.js refuses every request until it knows the
  // public address (AUTH_URL) or is told to trust the proxy's host headers.
  if (process.env.NODE_ENV === "production" && !read("AUTH_URL") && !read("AUTH_TRUST_HOST")) {
    missing.push("AUTH_URL");
  }
  return missing;
}

export function keycloakSettings(): { issuer: string; clientId: string } {
  return {
    issuer: required("KEYCLOAK_ISSUER").replace(/\/+$/, ""),
    clientId: read("KEYCLOAK_CLIENT_ID") ?? "skymail",
  };
}

export function publicConfig(): PublicConfig {
  return {
    apiUrl: required("API_URL").replace(/\/+$/, ""),
    consoles: [
      { id: "admin", label: "Yönetim", href: read("ADMIN_URL") ?? "https://admin.yildizskylab.com" },
      {
        id: "forms",
        label: "Forms",
        href: read("FORMS_ADMIN_URL") ?? "https://forms.yildizskylab.com/admin",
      },
    ],
  };
}
