/**
 * Puts the templates in emails/ into a SkyMail instance, addressed by key.
 *
 * Seeding is an upsert, so running it twice is the same as running it once, and
 * a template that was archived comes back. Nothing is deleted: a key that is no
 * longer in emails/ is left alone and reported, because archiving something a
 * live service still calls is how mail silently stops.
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

  for (const { meta, Component } of templates) {
    const html = await render(React.createElement(Component), { pretty: true });
    const plainText = await render(React.createElement(Component), { plainText: true });

    const body = {
      name: meta.name,
      subject: meta.subject,
      html_content: html,
      plain_text_content: plainText,
      // The .tsx source is what an editor sees in SkyMail's Monaco pane, so the
      // template stays editable there even though its home is this repo.
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

    const saved = (await response.json()) as { id: string };
    seeded += 1;
    console.log(`✓ ${meta.key.padEnd(34)} ${saved.id}`);
  }

  if (!DRY_RUN) {
    console.log(`\n${seeded} şablon ${BASE_URL} üzerine yazıldı.`);
    console.log("Repoda olmayan anahtarlar silinmedi — canlı bir servisin çağırdığı şablonu arşivlemek postayı sessizce durdurur.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
