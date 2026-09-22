/**
 * Turns the compose form's plain writing into the narrow HTML the free-form
 * template accepts.
 *
 * The rule that makes this safe is that it never passes input through: every
 * character the sender types is escaped first, and the tags in the output are
 * only ones this file emits. So the result cannot contain a tag the allowlist
 * does not have, whatever the sender pastes in. skymail-backend sanitises the
 * same allowlist again with bluemonday before rendering, so this is the first
 * of two gates, not the only one.
 *
 * The supported subset is what a club announcement actually needs:
 *
 *   ## Başlık          → <h2>
 *   ### Alt başlık     → <h3>
 *   **kalın**          → <strong>
 *   *italik*           → <em>
 *   [metin](https://…) → <a href="…">
 *   - madde            → <ul><li>
 *   1. madde           → <ol><li>
 *   > alıntı           → <blockquote>
 *   boş satır          → yeni paragraf
 */

const ALLOWED_LINK_SCHEMES = ["http://", "https://", "mailto:"];

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isAllowedUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return ALLOWED_LINK_SCHEMES.some((scheme) => trimmed.startsWith(scheme));
}

/** Inline marks, applied to already-escaped text. */
function applyInline(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, url: string) => {
      // A link to somewhere we would not follow is left as the text the sender
      // typed, rather than silently dropped — they can see what happened.
      if (!isAllowedUrl(url)) {
        return whole;
      }
      return `<a href="${url}">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

type Block =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; lines: string[] };

function groupIntoBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | undefined;

  const flush = () => {
    if (current) {
      blocks.push(current);
      current = undefined;
    }
  };

  for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (line === "") {
      flush();
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length === 2 ? 2 : 3, text: heading[2] });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (current?.kind !== "list" || current.ordered) {
        flush();
        current = { kind: "list", ordered: false, items: [] };
      }
      current.items.push(bullet[1]);
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (current?.kind !== "list" || !current.ordered) {
        flush();
        current = { kind: "list", ordered: true, items: [] };
      }
      current.items.push(numbered[1]);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      if (current?.kind !== "quote") {
        flush();
        current = { kind: "quote", lines: [] };
      }
      current.lines.push(quote[1]);
      continue;
    }

    if (current?.kind !== "paragraph") {
      flush();
      current = { kind: "paragraph", lines: [] };
    }
    current.lines.push(line);
  }

  flush();
  return blocks;
}

export function toEmailHtml(source: string): string {
  const inline = (text: string) => applyInline(escapeHtml(text));

  return groupIntoBlocks(source)
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `<h${block.level}>${inline(block.text)}</h${block.level}>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items.map((item) => `<li>${inline(item)}</li>`).join("");
          return `<${tag}>${items}</${tag}>`;
        }
        case "quote":
          return `<blockquote>${block.lines.map(inline).join("<br />")}</blockquote>`;
        case "paragraph":
          return `<p>${block.lines.map(inline).join("<br />")}</p>`;
      }
    })
    .join("");
}

/**
 * The variables a template will ask the sender for.
 *
 * SkyMail does not store a template's variable list, so it is read back out of
 * the rendered template: whatever the body and subject interpolate is what the
 * sender has to supply. Email and FullName are left out because the mailer adds
 * them per recipient.
 */
const MAILER_PROVIDED = ["Email", "FullName"];

export function extractVariables(...sources: (string | undefined | null)[]): string[] {
  const found = new Set<string>();

  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const match of source.matchAll(/\{\{(?:if |safeHTML )?\s*\.(\w+)\s*\}\}/g)) {
      found.add(match[1]);
    }
    // `{{if eq .Decision `approved`}}` and other function calls.
    for (const match of source.matchAll(/\{\{if\s+\w+\s+\.(\w+)/g)) {
      found.add(match[1]);
    }
  }

  return [...found].filter((name) => !MAILER_PROVIDED.includes(name)).sort();
}

/** The one variable that carries markup rather than text. */
export const RICH_TEXT_VARIABLE = "BodyHtml";
