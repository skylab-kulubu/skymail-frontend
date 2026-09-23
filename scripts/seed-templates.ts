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

  const token = DRY_RUN ? "" : await resolveToken();
  let seeded = 0;
  const kept: { key: string; subject: string }[] = [];

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

    if (DRY_RUN) {
      console.log(`· ${meta.key.padEnd(34)} ${meta.system ? "[sistem]" : "        "} "${meta.subject}"`);
      continue;
    }

    const response = await fetch(`${BASE_URL}/v1/templates/by-key/${encodeURIComponent(meta.key)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${meta.key} yazılamadı: HTTP ${response.status} ${detail.slice(0, 200)}`);
    }

    const saved = (await response.json()) as { id: string; subject: string };
    seeded += 1;

    // A subject is seeded once and then belongs to the row, so an operator can
    // reword it without a release. Saying so here is what keeps that from
    // looking like the seed silently failed to apply the repo's wording.
    const keptSubject = saved.subject !== meta.subject;
    if (keptSubject) {
      kept.push({ key: meta.key, subject: saved.subject });
    }
    console.log(`✓ ${meta.key.padEnd(34)} ${saved.id}${keptSubject ? "  · konu korundu" : ""}`);
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
    console.log("Repoda olmayan anahtarlar silinmedi — canlı bir servisin çağırdığı şablonu arşivlemek postayı sessizce durdurur.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
