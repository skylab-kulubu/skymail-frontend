/**
 * The checks emails:render holds every template in emails/ to, each catching
 * a defect that has reached an inbox before and shows only once a mail is
 * sent. They read a rendered body and its plain text, so the Visual mode's
 * tests hold what a Visual document renders to the same checks
 * (src/lib/mail-render/visual.test.ts).
 *
 * Moved here unchanged from render-templates.ts; do not loosen them.
 */
import { blockBalance, referencedVariables } from "../src/lib/mail-render";
import { gluedLinks } from "../src/lib/mail-render/warnings";

export function checkBalancedActions(key: string, body: string, problems: string[]): void {
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
export function checkOpaqueSurfaces(key: string, body: string, problems: string[]): void {
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

export function checkBackgroundLayersAreThemed(key: string, body: string, problems: string[]): void {
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
export function checkPlainTextIsReadable(key: string, html: string, plainText: string, problems: string[]): void {
  // The rule lives in the render module, which also warns an operator of it in every mode.
  for (const sample of gluedLinks(html, plainText)) {
    problems.push(`${key}: düz metinde bitişik yazılmış bağlantı → ${sample} — araya boşluk gerekiyor`);
  }
}

export function checkSubjectVariables(key: string, subject: string, declared: string[], problems: string[]): void {
  for (const name of referencedVariables(subject)) {
    if (!declared.includes(name)) {
      problems.push(
        `${key}: konu satırı {{.${name}}} kullanıyor ama bu değişken meta.variables içinde yok — gönderen doldurmazsa konuda "<no value>" yazar`,
      );
    }
  }
}
