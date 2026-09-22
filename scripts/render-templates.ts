/**
 * Renders every template to build/emails/ so a human can open them, and checks
 * the things that silently break an e-mail:
 *
 *  - a Go action that JSX ate (a stray `{{` with no closing `}}`),
 *  - a subject that references a variable the template does not declare,
 *  - an `{{if}}` without its `{{end}}`.
 *
 * Run it before seeding. It needs no server and no credentials.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import React from "react";
import { render } from "@react-email/render";
import { templates } from "../emails";

const OUT_DIR = join(process.cwd(), "build", "emails");

/** Replaces the Go actions with sample values so a preview reads like a real mail. */
function fillSample(html: string, sample: Record<string, unknown>): string {
  let filled = html;

  // Drop the conditionals, keeping the "value is present" branch.
  filled = filled.replace(/\{\{if [^}]+\}\}/g, "").replace(/\{\{end\}\}/g, "");
  filled = filled.replace(/\{\{safeHTML \.(\w+)\}\}/g, (_match, name: string) => String(sample[name] ?? ""));
  filled = filled.replace(/\{\{\.(\w+)\}\}/g, (_match, name: string) => String(sample[name] ?? `«${name}»`));

  return filled;
}

function checkBalancedActions(key: string, body: string, problems: string[]): void {
  const opens = (body.match(/\{\{if /g) ?? []).length;
  const ends = (body.match(/\{\{end\}\}/g) ?? []).length;
  if (opens !== ends) {
    problems.push(`${key}: ${opens} adet {{if}} var ama ${ends} adet {{end}} — dengesiz`);
  }

  // A brace that survived JSX as a literal, e.g. "{.link}" instead of "{{.link}}".
  const stray = body.match(/(?<!\{)\{\.[A-Za-z]/g);
  if (stray) {
    problems.push(`${key}: tek süslü parantezli değişken kalmış (${stray.join(", ")}) — JSX yutmuş`);
  }
}

function checkSubjectVariables(key: string, subject: string, declared: string[], problems: string[]): void {
  for (const match of subject.matchAll(/\{\{\.(\w+)\}\}/g)) {
    const name = match[1];
    if (!declared.includes(name)) {
      problems.push(
        `${key}: konu satırı {{.${name}}} kullanıyor ama bu değişken meta.variables içinde yok — gönderen doldurmazsa konuda "<no value>" yazar`,
      );
    }
  }
}

/**
 * The catalogue is generated rather than written, so the names, subjects and
 * variables in it cannot drift from the templates they describe.
 */
function buildCatalogue(): string {
  const lines = [
    "# SkyMail şablon kataloğu",
    "",
    "`yarn emails:render` tarafından `emails/` içindeki kaynaklardan üretilir — elle düzenleme.",
    "",
    "Her şablona ayrıca `Email` ve `FullName` değişkenleri mailer tarafından eklenir.",
    "Konu satırı ve düz metin Go `text/template` ile render edilir: eksik bir değişken orada",
    "`<no value>` basar (HTML tarafında boş basar), o yüzden konuda yalnızca gönderenin her",
    "zaman verdiği değişkenler kullanılır.",
    "",
    "| Şablon adı | key | Konu | Değişkenler |",
    "| --- | --- | --- | --- |",
  ];

  for (const { meta } of templates) {
    const variables = meta.variables.map((name) => `\`${name}\``).join(", ") || "—";
    const system = meta.system ? " 🔒" : "";
    lines.push(`| ${meta.name}${system} | \`${meta.key}\` | ${meta.subject} | ${variables} |`);
  }

  lines.push("", "🔒 = sistem şablonu: arşivlenemez, anahtarı değiştirilemez.", "", "## Ne zaman gider", "");

  for (const { meta } of templates) {
    lines.push(`- **${meta.name}** (\`${meta.key}\`) — ${meta.trigger}`);
  }

  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const problems: string[] = [];

  for (const { meta, Component } of templates) {
    const html = await render(React.createElement(Component), { pretty: true });
    const plainText = await render(React.createElement(Component), { plainText: true });

    checkBalancedActions(meta.key, html, problems);
    checkSubjectVariables(meta.key, meta.subject, meta.variables, problems);

    await writeFile(join(OUT_DIR, `${meta.key}.html`), html, "utf8");
    await writeFile(join(OUT_DIR, `${meta.key}.txt`), plainText, "utf8");
    await writeFile(join(OUT_DIR, `${meta.key}.preview.html`), fillSample(html, meta.sample), "utf8");

    console.log(`✓ ${meta.key.padEnd(34)} ${String(html.length).padStart(6)} bayt HTML · "${meta.subject}"`);
  }

  await writeFile(join(process.cwd(), "emails", "CATALOG.md"), buildCatalogue(), "utf8");

  if (problems.length > 0) {
    console.error("\nSorunlar:");
    for (const problem of problems) {
      console.error(`  ✗ ${problem}`);
    }
    process.exit(1);
  }

  console.log(`\n${templates.length} şablon ${OUT_DIR} altına yazıldı. *.preview.html örnek değerlerle dolu.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
