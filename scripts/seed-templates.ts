/**
 * Puts the templates in emails/ into a SkyMail instance, addressed by key.
 *
 * Seeding is an upsert: a template that was archived comes back, and nothing
 * is deleted — a key that is no longer in emails/ is left alone, because
 * archiving something a live service still calls is how mail silently stops.
 * Each template goes with its .tsx source as its JSX source, the render of
 * that source, its subject and its contract Required variables.
 *
 * SkyMail refuses a template an operator changed since the last seed
 * (ADR-0047). The run goes on with the others, lists the refused ones with
 * why and the command that forces each, and exits non-zero. Forcing writes
 * over the operator's change; their versions stay in the template's history.
 * What the run does is src/lib/template-seed; this is its command line:
 *
 *   --dry-run                       nothing is sent; lists what would be
 *   --force=<key>[,<key>]           writes these even over an operator's change
 *   --force-all                     writes every template so
 *   --allow-stale                   seeds even from a checkout behind origin/main
 *
 * Credentials come from the environment and are never printed:
 *
 *   SKYMAIL_URL                 http://localhost:3000 (varsayılan)
 *   SKYMAIL_TOKEN               hazır bir bearer token, ya da
 *   KEYCLOAK_TOKEN_URL          client-credentials ile alınsın:
 *   KEYCLOAK_CLIENT_ID
 *   KEYCLOAK_CLIENT_SECRET
 *
 * The seed renders from the working tree, so before the first request it
 * refuses a checkout that is missing a commit of origin/main in the templates
 * or in what renders them (src/lib/template-seed/freshness).
 *
 * Needs skymail:access + skymail:templates:write, and a skymail-backend that
 * knows the conflict rule (ticket 09): an older one ignores --force and keeps
 * an operator's subject without a word.
 */
import { execFileSync } from "node:child_process";
import { templates } from "../emails";
import { SEED_COMMAND, parseSeedArgs, runSeed, templateSources } from "../src/lib/template-seed";
import { checkFreshness, staleMessage } from "../src/lib/template-seed/freshness";

const BASE_URL = (process.env.SKYMAIL_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** Runs git, or null when it fails — a missing remote and a tarball both land here. */
function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
      // A credential prompt would hang the seed instead of failing it.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    }).trim();
  } catch {
    return null;
  }
}

async function resolveToken(): Promise<string> {
  const direct = process.env.SKYMAIL_TOKEN;
  if (direct) {
    return direct;
  }

  const tokenUrl = process.env.KEYCLOAK_TOKEN_URL;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      "Kimlik yok: ya SKYMAIL_TOKEN ver ya da KEYCLOAK_TOKEN_URL + KEYCLOAK_CLIENT_ID + KEYCLOAK_CLIENT_SECRET ver.",
    );
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    // The body can carry the client secret back in an error description.
    throw new Error(`Keycloak token alınamadı: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Keycloak yanıtında access_token yok.");
  }
  return payload.access_token;
}

async function main(): Promise<number> {
  const args = parseSeedArgs(
    process.argv.slice(2),
    templates.map(({ meta }) => meta.key),
  );
  if (!args.ok) {
    console.error(args.message);
    return 2;
  }

  if (!args.allowStale) {
    const freshness = checkFreshness(git);
    for (const note of freshness.notes) {
      console.log(`${note}\n`);
    }
    if (freshness.state === "stale") {
      console.error(staleMessage(freshness.commits, SEED_COMMAND));
      return 1;
    }
  }

  const sources = await templateSources(templates);
  const token = args.dryRun ? "" : await resolveToken();
  return runSeed({
    baseUrl: BASE_URL,
    token,
    templates: sources,
    dryRun: args.dryRun,
    force: args.force,
    fetch,
    print: (line) => console.log(line),
  });
}

main().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
