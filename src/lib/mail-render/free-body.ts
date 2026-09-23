/**
 * A free announcement's body: a Visual document as the plain markup that
 * free.basic's `{{safeHTML .BodyHtml}}` takes (ticket 16).
 *
 * The body is the sender's input, not a trusted template, so the server
 * narrows it to an allow-list before it reaches anyone (sanitize.go, see
 * server-allowlist.ts): no style, no class, no image. The club's mail
 * components carry their look in exactly those, so this renderer writes none
 * of them — free.basic's own frame gives the body its look — and it is not
 * the Visual render (visual.tsx), which draws a whole mail. It writes only
 * what the allow-list keeps, as the server writes it back: a heading as
 * `h2`, a paragraph as `p`, bold, italic and links, and a button as a bold
 * link in a paragraph of its own. Text is escaped the way Go escapes it and
 * a link's address is the one Go writes, so the server keeps the body byte
 * for byte and the preview shows what goes out (free-body.test.ts).
 *
 * The document may use only FREE_BODY_ALLOWANCE. BodyHtml is data to the
 * mailer, never parsed as a template, so a variable or a conditional section
 * would reach the recipient as `{{.X}}`; an image and a rule would be dropped.
 * The server's allow-list is the trust boundary and does not move; widening
 * it is a decision of its own.
 */
import { escapeLikeGo, serverHref } from "./server-allowlist";
import { parseVisualSource, readVisualDocument, type VisualAllowance, type VisualDocument, type VisualInline } from "./visual-document";

/** What a free announcement's body may use: what the server's allow-list keeps. */
export const FREE_BODY_ALLOWANCE: VisualAllowance = {
  blocks: ["heading", "paragraph", "button"],
  marks: ["bold", "italic", "link"],
  variables: false,
};

/** The body's markup — empty when nothing in the document shows — or what keeps it from going out. */
export type FreeBody = { ok: true; html: string } | { ok: false; problems: string[] };

/**
 * A link's address as the server writes it back: first as a browser reads
 * it (a space becomes %20), then as Go does. Null when the server would drop
 * the link.
 */
function hrefFor(address: string): string | null {
  let normalised: string;
  try {
    normalised = new URL(address).href;
  } catch {
    return null;
  }
  return serverHref(normalised);
}

const unkept = (address: string) => `"${address}" adresini sunucu kabul etmiyor; mailde bağlantı düşer. Adresi düzelt.`;

/** The document as the body's markup. It is read with FREE_BODY_ALLOWANCE first: nothing outside it renders. */
export function renderFreeBody(document: VisualDocument): FreeBody {
  const read = readVisualDocument(document, FREE_BODY_ALLOWANCE);
  if (!read.ok) return read;
  const problems: string[] = [];

  const link = (address: string, path: string) => {
    const href = hrefFor(address);
    if (href === null) problems.push(`${path}: ${unkept(address)}`);
    return (inner: string) => (href === null ? inner : `<a href="${escapeLikeGo(href)}">${inner}</a>`);
  };

  // A link inside, then italic, then bold: the Visual render's order.
  const inline = (node: VisualInline, path: string): string => {
    // The allowance has no variables, so every inline is text.
    let content = node.type === "text" ? escapeLikeGo(node.text) : "";
    const marks = node.marks ?? [];
    const address = marks.find((mark) => mark.type === "link");
    if (address) content = link(address.href, path)(content);
    if (marks.some((mark) => mark.type === "italic")) content = `<em>${content}</em>`;
    if (marks.some((mark) => mark.type === "bold")) content = `<strong>${content}</strong>`;
    return content;
  };

  const html = read.document.blocks
    .map((block, index) => {
      const path = `blocks[${index}]`;
      const inlines = (content: readonly VisualInline[]) => content.map((node, at) => inline(node, `${path}.content[${at}]`)).join("");
      switch (block.type) {
        case "heading":
          return block.content.length === 0 ? "" : `<h2>${inlines(block.content)}</h2>`;
        case "paragraph":
          return block.content.length === 0 ? "" : `<p>${inlines(block.content)}</p>`;
        case "button":
          // The allowance has no variables, so a button's link is an address.
          return "url" in block.link ? `<p>${link(block.link.url, `${path}.link`)(`<strong>${escapeLikeGo(block.label)}</strong>`)}</p>` : "";
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
