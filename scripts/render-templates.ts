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
import { templates } from "../emails";
import { fillSampleValues, renderComponent } from "../src/lib/mail-render";
import {
  checkBackgroundLayersAreThemed,
  checkBalancedActions,
  checkOpaqueSurfaces,
  checkPlainTextIsReadable,
  checkSubjectVariables,
} from "./mail-checks";

const OUT_DIR = join(process.cwd(), "build", "emails");

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
    "",
    "**Konu sütunu canlıya seed ile gider.** Seed her koşuda konuyu da buradan yazar. Son seed'den",
    "sonra bir operatör şablonu SkyMail'de değiştirdiyse (konusu ya da bir taslağı dahil) SkyMail o",
    "şablonu reddeder ve hiçbir şeyini yazmaz; seed reddedilenleri, nedenini ve zorlama komutunu",
    "(`--force=<anahtar>`) listeler. Zorlamak operatörün sürümlerini silmez, geçmişte kalırlar (ADR-0047).",
    "",
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
    // The render module is what the panel renders with too, so what is checked
    // here is what an operator gets.
    const rendered = await renderComponent(Component);
    if (!rendered.ok) {
      throw new Error(`${meta.key}: ${rendered.message}`);
    }
    const { html, plainText } = rendered;

    checkBalancedActions(meta.key, html, problems);
    checkOpaqueSurfaces(meta.key, html, problems);
    checkBackgroundLayersAreThemed(meta.key, html, problems);
    checkPlainTextIsReadable(meta.key, html, plainText, problems);
    checkSubjectVariables(meta.key, meta.subject, meta.variables, problems);

    await writeFile(join(OUT_DIR, `${meta.key}.html`), html, "utf8");
    await writeFile(join(OUT_DIR, `${meta.key}.txt`), plainText, "utf8");
    await writeFile(join(OUT_DIR, `${meta.key}.preview.html`), fillSampleValues(html, meta.sample), "utf8");

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
