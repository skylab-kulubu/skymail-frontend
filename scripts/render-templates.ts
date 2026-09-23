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
import { blockBalance, fillSampleValues, referencedVariables, renderComponent } from "../src/lib/mail-render";

const OUT_DIR = join(process.cwd(), "build", "emails");

function checkBalancedActions(key: string, body: string, problems: string[]): void {
  const { opens, ends } = blockBalance(body);
  if (opens !== ends) {
    problems.push(`${key}: ${opens} blok ({{if}}, {{range}}, {{with}}…) açılıyor ama ${ends} adet {{end}} var — dengesiz`);
  }

  // A brace that survived JSX as a literal, e.g. "{.link}" instead of "{{.link}}".
  const stray = body.match(/(?<!\{)\{\.[A-Za-z]/g);
  if (stray) {
    problems.push(`${key}: tek süslü parantezli değişken kalmış (${stray.join(", ")}) — JSX yutmuş`);
  }
}

/**
 * A mail client that darkens a light e-mail on its own — which is most of them,
 * because an e-mail cannot rely on prefers-color-scheme — darkens what is behind
 * a translucent surface but leaves the surface, and the mail arrives washed out.
 * Opaque surfaces invert predictably, so a translucent one is a defect.
 */
function checkOpaqueSurfaces(key: string, body: string, problems: string[]): void {
  const inlineStyles = [...body.matchAll(/style="([^"]*)"/g)].map((match) => match[1]);

  for (const style of inlineStyles) {
    for (const declaration of style.split(";")) {
      const [property, value] = declaration.split(":").map((part) => part?.trim());
      if (!property || !value) {
        continue;
      }
      if (!/^(background|background-color|border(-[a-z]+)?-color|border(-[a-z]+)?)$/.test(property)) {
        continue;
      }
      if (value.includes("rgba(") || value.includes("hsla(")) {
        problems.push(`${key}: saydam yüzey → ${property}: ${value} — opak renk kullan`);
      }
    }
  }
}

/**
 * Dark mode is carried by role classes, so an element that paints a background
 * without one stays light while everything around it goes dark — and paints
 * over what is behind it. react-email can introduce such an element on its own:
 * an inline background on <Body> is copied onto a wrapper cell it generates,
 * and that cell has no class. Invisible until the mail lands in an inbox.
 */
const DARK_AWARE_CLASSES = [
  "email-bg",
  "card",
  "chip",
  "alert-chip",
  "note-box",
  "cta",
  "code-block",
];

function checkBackgroundLayersAreThemed(key: string, body: string, problems: string[]): void {
  for (const match of body.matchAll(/<(body|table|td|div)\b([^>]*?)>/gs)) {
    const [, tag, attributes] = match;

    const paintsBackground =
      /background-color:\s*[^;"]+/.test(attributes) || /bgcolor="[^"]+"/.test(attributes);
    if (!paintsBackground) {
      continue;
    }

    const classes = /class="([^"]*)"/.exec(attributes)?.[1] ?? "";
    const themed = DARK_AWARE_CLASSES.some((name) => classes.split(/\s+/).includes(name));
    if (!themed) {
      problems.push(
        `${key}: <${tag}> arka plan boyuyor ama koyu mod sınıfı yok (class="${classes}") — koyu modda açık kalır`,
      );
    }
  }
}

/**
 * The plain-text part is derived from the same markup, and html-to-text joins
 * adjacent table cells with no whitespace at all. A link whose URL lands right
 * against the next cell's text reads as one mangled word — "…yildizskylab.comby
 * WEBLAB". Visible only in the text part, which is exactly why it survived.
 *
 * Rather than guess at the shape of the damage, this takes the hrefs the
 * template actually contains and checks that each one ends where it should.
 */
function checkPlainTextIsReadable(key: string, html: string, plainText: string, problems: string[]): void {
  const hrefs = new Set(
    [...html.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1].replace(/&amp;/g, "&"))
      .filter((href) => /^(https?:|mailto:)/.test(href)),
  );

  for (const href of hrefs) {
    let from = 0;
    for (;;) {
      const at = plainText.indexOf(href, from);
      if (at === -1) {
        break;
      }
      from = at + href.length;

      // A letter straight after the URL means the next cell's text was glued on.
      // Punctuation and path characters are how a longer URL continues, and that
      // longer URL is its own href and gets checked on its own.
      const next = plainText[from];
      if (next && /\p{L}/u.test(next)) {
        const sample = plainText.slice(at, from + 12);
        problems.push(`${key}: düz metinde bitişik yazılmış bağlantı → ${sample} — araya boşluk gerekiyor`);
      }
    }
  }
}

function checkSubjectVariables(key: string, subject: string, declared: string[], problems: string[]): void {
  for (const name of referencedVariables(subject)) {
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
