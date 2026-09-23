/**
 * A free announcement's body: a Visual document as the plain markup that
 * free.basic's `{{safeHTML .BodyHtml}}` takes (ticket 16).
 *
 * The body is the sender's input, not a trusted template, so the server
 * narrows it to an allow-list before it reaches anyone (skymail-backend
 * internal/mailer/sanitize.go: no style, no class, no image). The club's mail
 * components carry their look in exactly those, so this renderer writes none
 * of them — free.basic's own frame gives the body its look — and it is not
 * the Visual render (visual.tsx), which draws a whole mail. It writes only
 * elements the allow-list keeps: a heading as `h2`, a paragraph as `p`, a
 * list as `ul` or `ol`, a line break as `br`, bold, italic and links
 * (free-body.test.ts holds its output to that list). The server still
 * sanitises; nothing here is a second gate.
 *
 * The document may use only FREE_BODY_ALLOWANCE. BodyHtml is data to the
 * mailer, never parsed as a template, so a variable or a conditional section
 * would reach the recipient as `{{.X}}`; an image and a rule would be
 * dropped, and a house button would arrive as a plain link (free.basic has
 * its own button fields). Widening the server's allow-list is a decision of
 * its own.
 */
import { goUrlString, parseGoUrl } from "./go-url";
import {
  parseVisualSource,
  readVisualDocument,
  type VisualAllowance,
  type VisualDocument,
  type VisualInline,
} from "./visual-document";

/** What a free announcement's body may use: what the server's allow-list keeps. */
export const FREE_BODY_ALLOWANCE: VisualAllowance = {
  blocks: ["heading", "paragraph", "list"],
  marks: ["bold", "italic", "link"],
  variables: false,
  lineBreaks: true,
};

/** The body's markup — empty when nothing in the document shows — or what keeps it from going out. */
export type FreeBody = { ok: true; html: string } | { ok: false; problems: string[] };

/** The schemes the server's allow-list keeps a link with (sanitize.go, AllowURLSchemes). */
const SERVER_LINK_SCHEMES = ["http", "https", "mailto"];

/**
 * A link's address as the server writes it back — first as a browser reads
 * it (a space becomes %20), then as Go's net/url does (go-url.ts) — or null
 * when the server would drop the link (bluemonday's validURL: an address
 * Go does not parse, or another scheme).
 */
function hrefFor(address: string): string | null {
  let normalised: string;
  try {
    normalised = new URL(address).href;
  } catch {
    return null;
  }
  const url = parseGoUrl(normalised);
  return url && SERVER_LINK_SCHEMES.includes(url.scheme) ? goUrlString(url) : null;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#34;", "'": "&#39;" })[c]!);

const unkept = (address: string) => `"${address}" adresini sunucu kabul etmiyor; mailde bağlantı düşer. Adresi düzelt.`;

/** The document as the body's markup. It is read with FREE_BODY_ALLOWANCE first: nothing outside it renders. */
export function renderFreeBody(document: VisualDocument): FreeBody {
  const read = readVisualDocument(document, FREE_BODY_ALLOWANCE);
  if (!read.ok) return read;
  const problems: string[] = [];

  // A link inside, then italic, then bold: the Visual render's order.
  const inline = (node: VisualInline, path: string): string => {
    // The allowance has no variables: an inline is text or a line break.
    if (node.type !== "text") return node.type === "hardBreak" ? "<br>" : "";
    let content = escapeHtml(node.text);
    const marks = node.marks ?? [];
    const address = marks.find((mark) => mark.type === "link");
    if (address) {
      const href = hrefFor(address.href);
      if (href === null) problems.push(`${path}: ${unkept(address.href)}`);
      else content = `<a href="${escapeHtml(href)}">${content}</a>`;
    }
    if (marks.some((mark) => mark.type === "italic")) content = `<em>${content}</em>`;
    if (marks.some((mark) => mark.type === "bold")) content = `<strong>${content}</strong>`;
    return content;
  };
  const line = (content: readonly VisualInline[], path: string) => content.map((node, at) => inline(node, `${path}[${at}]`)).join("");

  const html = read.document.blocks
    .map((block, index) => {
      const path = `blocks[${index}]`;
      switch (block.type) {
        case "heading":
          return block.content.length === 0 ? "" : `<h2>${line(block.content, `${path}.content`)}</h2>`;
        case "paragraph":
          return block.content.length === 0 ? "" : `<p>${line(block.content, `${path}.content`)}</p>`;
        case "list": {
          const items = block.items
            .map((item, at) => (item.length === 0 ? "" : `<li>${line(item, `${path}.items[${at}]`)}</li>`))
            .join("");
          const tag = block.ordered ? "ol" : "ul";
          return items === "" ? "" : `<${tag}>${items}</${tag}>`;
        }
        default:
          throw new Error(`Serbest duyuru gövdesi "${block.type}" bloğunu yazmaz.`);
      }
    })
    .join("");
  return problems.length > 0 ? { ok: false, problems } : { ok: true, html };
}

/** A Visual source (the editor's JSON text) as the body's markup. */
export function freeBodyFromSource(source: string): FreeBody {
  const read = parseVisualSource(source, FREE_BODY_ALLOWANCE);
  return read.ok ? renderFreeBody(read.document) : read;
}
