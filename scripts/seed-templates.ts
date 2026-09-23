/**
 * Puts the templates in emails/ into a SkyMail instance, addressed by key.
 *
 * Seeding is an upsert, so running it twice is the same as running it once, and
 * a template that was archived comes back. Nothing is deleted: a key that is no
 * longer in emails/ is left alone and reported, because archiving something a
 * live service still calls is how mail silently stops.
 *
 * One field is not overwritten: a subject is seeded when the key is new and
 * then belongs to the row, so an operator can reword it without a release
 * (ADR-0045). A run that finds a reworded subject says so rather than leaving
 * it to look like the repo's wording quietly failed to apply.
 *
 * A skymail-backend with the seed conflict rule (ADR-0047, rewrite ticket 09)
 * writes the subject again and instead refuses a template an operator changed
 * since the last seed, with 409 template.seed_conflict, writing nothing to it.
 * The run goes on with the other templates, lists the refused ones with why
 * and the command that forces each, and exits non-zero. --force=<key>[,<key>]
 * and --force-all write over the operator's change (?force=true); their
 * versions stay in the template's history. An older backend ignores both.
 *
 * Credentials come from the environment and are never printed:
 *
 *   SKYMAIL_URL                 http://localhost:3000 (varsayılan)
 *   SKYMAIL_TOKEN               hazır bir bearer token, ya da
 *   KEYCLOAK_TOKEN_URL          client-credentials ile alınsın:
 *   KEYCLOAK_CLIENT_ID
 *   KEYCLOAK_CLIENT_SECRET
 *
 * Needs skymail:access + skymail:templates:write. Pass --dry-run to see what
 * would change without touching anything.
 */
import React from "react";
import { render } from "@react-email/render";
import { templates } from "../emails";

const BASE_URL = (process.env.SKYMAIL_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const DRY_RUN = process.argv.includes("--dry-run");
const SEED_COMMAND = "corepack yarn emails:seed";

/** The keys --force=<key>[,<key>] names, or "all" for --force-all. A key the seed does not have is a mistake. */
function forcedKeys(): Set<string> | "all" {
  if (process.argv.includes("--force-all")) {
    return "all";
  }
  const known = new Set(templates.map(({ meta }) => meta.key));
  const keys = new Set<string>();
  for (const arg of process.argv.slice(2)) {
    if (arg !== "--force" && !arg.startsWith("--force=")) {
      continue;
    }
    const named = arg.slice("--force=".length).split(",").filter((key) => key !== "");
    if (named.length === 0) {
      throw new Error("--force hangi şablonların zorlanacağını söylemeli: --force=<anahtar>[,<anahtar>] ya da --force-all.");
    }
    for (const key of named) {
      if (!known.has(key)) {
        throw new Error(`--force bilinmeyen anahtar: ${key}. Seed'in anahtarları emails/CATALOG.md'de.`);
      }
      keys.add(key);
    }
  }
  return keys;
}

/** A version a refusal or a force names, as far as the report reads it. */
interface ConflictVersion {
  id: string;
  seq: number;
  subject: string;
  author: { kind: string; name: string | null };
  created_at: string;
  published_at: string | null;
}

/** What a forced seed wrote over, as a backend with the conflict rule answers it. */
interface Override {
  rules: string[];
  published_version: ConflictVersion | null;
  operator_versions: ConflictVersion[];
}

/** The params of 409 template.seed_conflict, as far as the report reads them. */
interface SeedConflict {
  rules: string[];
  published_version: ConflictVersion | null;
  last_seed_version: ConflictVersion | null;
  operator_versions: ConflictVersion[];
  subject: string;
  requested_subject: string;
}

const who = (version: ConflictVersion) => version.author.name ?? "adı bilinmiyor";

const DAY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

// A report must not be more fragile than what it reports on: a missing or
// malformed timestamp says so instead of throwing (and losing the list of
// refused templates) or printing 1 January 1970 for a null.
function day(value: string | null | undefined): string {
  const at = value ? new Date(value) : null;
  return at && !Number.isNaN(at.getTime()) ? DAY.format(at) : "tarih yok";
}

/**
 * What a forced template's line says. Only a backend with the conflict rule
 * forces, and it says what it overrode; today's ignores ?force=true, so an
 * answer that names nothing only says force was asked for.
 */
function forceNote(overrode: Override | undefined): string {
  if (!overrode) {
    return "zorla istendi";
  }
  const versions = new Map<string, ConflictVersion>();
  const published = overrode.published_version;
  if (published && published.author.kind === "operator") {
    versions.set(published.id, published);
  }
  for (const version of overrode.operator_versions ?? []) {
    versions.set(version.id, version);
  }
  const replaced = [...versions.values()]
    .sort((a, b) => a.seq - b.seq)
    .map((v) => `#${v.seq} ${v.published_at === null ? "taslak" : "yayımlanmış sürüm"}, ${who(v)}, ${day(v.published_at ?? v.created_at)}`);
  if ((overrode.rules ?? []).includes("operator_subject") && published) {
    replaced.push(`operatörün konusu "${published.subject}"`);
  }
  if (replaced.length === 0) {
    replaced.push((overrode.rules ?? []).join(", "));
  }
  return `zorlandı: ${replaced.join("; ")} — geçmişte duruyor, geri getirilebilir`;
}

/** Each rule that held, in words, with the versions involved. */
function reasons(conflict: SeedConflict): string[] {
  const lastSeed = conflict.last_seed_version;
  return (conflict.rules ?? []).map((rule) => {
    switch (rule) {
      case "published_by_operator": {
        const since = lastSeed ? `son seed #${lastSeed.seq}` : "bu şablonu hiçbir seed yazmamış";
        const published = conflict.published_version;
        return published
          ? `Gönderilen sürüm #${published.seq} bir operatörün (${who(published)}); ${since}.`
          : `Gönderilen sürüm son seed'in değil; ${since}.`;
      }
      case "newer_operator_version":
        return `Son seed'den sonra operatör sürümleri var: ${(conflict.operator_versions ?? [])
          .map((v) => `#${v.seq} ${v.published_at === null ? "taslak" : "yayımlı"} (${who(v)})`)
          .join(", ")}.`;
      case "operator_subject":
        return `Konu operatörün: şu an "${conflict.subject}", repo "${conflict.requested_subject}" istiyor.`;
      default:
        return `Kural: ${rule}.`;
    }
  });
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

async function main(): Promise<void> {
  if (DRY_RUN) {
    console.log(`[kuru çalışma] ${BASE_URL} üzerine hiçbir şey yazılmayacak.\n`);
  }

  const force = forcedKeys();
  const token = DRY_RUN ? "" : await resolveToken();
  let seeded = 0;
  const kept: { key: string; subject: string }[] = [];
  const refused: { key: string; conflict: SeedConflict }[] = [];
  let failure: string | null = null;

  for (const { meta, Component } of templates) {
    const html = await render(React.createElement(Component), { pretty: true });
    const plainText = await render(React.createElement(Component), { plainText: true });

    const body = {
      name: meta.name,
      subject: meta.subject,
      html_content: html,
      plain_text_content: plainText,
      // Not the .tsx source: a pointer back to it. The template's home is this
      // repo, and SkyMail's Monaco pane cannot compile a comment, so the editor
      // refuses to save one over the rendered body (see lib/template-render).
      react_email_content: `// Kaynak: skymail-frontend/emails/${meta.key}.tsx — burada düzenlersen repodaki kaynakla ayrışır.\n`,
      system: meta.system,
    };

    const forced = force === "all" || force.has(meta.key);
    if (DRY_RUN) {
      console.log(`· ${meta.key.padEnd(34)} ${meta.system ? "[sistem]" : "        "}${forced ? " [zorla]" : ""} "${meta.subject}"`);
      continue;
    }

    const response = await fetch(`${BASE_URL}/v1/templates/by-key/${encodeURIComponent(meta.key)}${forced ? "?force=true" : ""}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      let error: { code?: string; params?: SeedConflict } = {};
      try {
        error = JSON.parse(detail);
      } catch {
        // Not the API's error shape; reported as it came.
      }
      if (response.status === 409 && error.code === "template.seed_conflict" && error.params) {
        refused.push({ key: meta.key, conflict: error.params });
        console.log(`✗ ${meta.key.padEnd(34)} reddedildi: son seed'den sonra bir operatör değiştirmiş`);
        continue;
      }
      // Anything else — an expired token, a failing server — would fail the
      // rest the same way.
      failure = `${meta.key} yazılamadı: HTTP ${response.status} ${detail.slice(0, 200)}`;
      break;
    }

    let saved: { id: string; subject: string; overrode?: Override };
    try {
      saved = (await response.json()) as typeof saved;
    } catch {
      // Not the template; stop, and keep what was refused so far for the report.
      failure = `${meta.key} yazılamadı: sunucudan okunamayan bir yanıt geldi (HTTP ${response.status})`;
      break;
    }
    seeded += 1;

    // A subject is seeded once and then belongs to the row, so an operator can
    // reword it without a release. Saying so here is what keeps that from
    // looking like the seed silently failed to apply the repo's wording.
    const keptSubject = saved.subject !== meta.subject;
    if (keptSubject) {
      kept.push({ key: meta.key, subject: saved.subject });
    }
    console.log(`✓ ${meta.key.padEnd(34)} ${saved.id}${keptSubject ? "  · konu korundu" : ""}${forced ? `  (${forceNote(saved.overrode)})` : ""}`);
  }

  if (!DRY_RUN) {
    console.log(`\n${seeded} şablon ${BASE_URL} üzerine yazıldı.`);
    if (kept.length > 0) {
      console.log(
        `\n${kept.length} şablonun konusu arayüzden değiştirilmiş, dokunulmadı — gövdeleri yine de güncellendi:`,
      );
      for (const { key, subject } of kept) {
        console.log(`  ${key.padEnd(34)} "${subject}"`);
      }
      console.log("Repodaki konuyu dayatmak istersen şablonu arayüzden düzenle; seed bunu yapmaz.");
    }
    if (refused.length > 0) {
      console.log(
        `\n${refused.length} şablon reddedildi: son seed'den sonra bir operatör değiştirmiş, üzerlerine hiçbir şey yazılmadı.`,
      );
      for (const { key, conflict } of refused) {
        console.log(`\n  ${key}`);
        for (const reason of reasons(conflict)) {
          console.log(`    ${reason}`);
        }
        console.log(`    Zorlamak için: ${SEED_COMMAND} --force=${key}`);
      }
      console.log(`\nReddedilenlerin hepsini zorlamak için: ${SEED_COMMAND} --force=${refused.map(({ key }) => key).join(",")}`);
      console.log(`Her şablonu zorlamak için: ${SEED_COMMAND} --force-all`);
      console.log(
        "Zorlamak operatörün çalışmasını silmez: sürümleri SkyMail'de şablonun geçmişinde kalır ve oradan geri getirilebilir.",
      );
    }
    console.log("Repoda olmayan anahtarlar silinmedi — canlı bir servisin çağırdığı şablonu arşivlemek postayı sessizce durdurur.");
  }

  if (failure) {
    throw new Error(failure);
  }
  if (refused.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
