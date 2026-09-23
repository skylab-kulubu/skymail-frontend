/**
 * A free announcement's body (free.basic's BodyHtml) read back into a Visual
 * document, so it can be edited again in the editor it was written in: an
 * approver's edit of a submitted send, a submitter's resubmission (ticket
 * 20). free-body.ts wrote it, so it is a handful of elements with no
 * attributes but a link's `href`; reading exactly those gives a document that
 * renders to the same markup, byte for byte.
 *
 * A body written some other way is read as well as it can be — an element
 * the editor has no block or mark for keeps its text, an address the editor
 * would not hold keeps its link text — and said not to be exact, so the page
 * can say that editing it rewrites it. Nothing here is a gate: the body is
 * shown to no one as HTML, and the server sanitises what is sent.
 */
import { renderFreeBody } from "./free-body";
import { buildVisual, linkAddressProblem, type VisualBlock, type VisualDocument, type VisualInline, type VisualMark } from "./visual-document";

export type FreeBodyRead = Readonly<{
  document: VisualDocument;
  /** The document renders to the very markup read. */
  exact: boolean;
}>;

const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)\/?>|([^<]+|<)/g;
const HREF = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

// A Map, not an object literal: a name comes from the body, and "constructor"
// must not find what every object inherits.
const NAMED = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
]);

function decode(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, name: string) => {
    if (name.startsWith("#")) {
      const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED.get(name) ?? whole;
  });
}

type Open =
  | { kind: "heading"; level: 2 | 3; content: VisualInline[] }
  | { kind: "paragraph" | "quote"; content: VisualInline[] }
  | { kind: "list"; ordered: boolean; items: VisualInline[][]; item: VisualInline[] | null };

const HEADINGS: ReadonlyMap<string, 2 | 3> = new Map([
  ["h1", 2],
  ["h2", 2],
  ["h3", 3],
  ["h4", 3],
  ["h5", 3],
  ["h6", 3],
]);

/** The body's markup as a Visual document the free announcement's editor holds. */
export function readFreeBody(html: string): FreeBodyRead {
  const blocks: VisualBlock[] = [];
  let open: Open | null = null;
  let bold = 0;
  let italic = 0;
  const links: (string | null)[] = [];
  let lost = false;

  const close = () => {
    if (open === null) return;
    if (open.kind === "list") {
      if (open.item !== null) open.items.push(open.item);
      const items = open.items.filter((item) => item.length > 0);
      if (items.length > 0) blocks.push(buildVisual.list(open.ordered, items));
    } else if (open.content.length > 0) {
      if (open.kind === "heading") blocks.push(buildVisual.heading(open.content, open.level === 3 ? 3 : undefined));
      else if (open.kind === "quote") blocks.push(buildVisual.quote(open.content));
      else blocks.push(buildVisual.paragraph(open.content));
    }
    open = null;
  };

  /** Where inline content goes now: the open block's, or a new paragraph's. */
  const line = (): { content: VisualInline[]; heading: boolean } => {
    if (open?.kind === "list") {
      open.item ??= [];
      return { content: open.item, heading: false };
    }
    if (open === null) open = { kind: "paragraph", content: [] };
    return { content: open.content, heading: open.kind === "heading" };
  };

  const marks = (): VisualMark[] => {
    const href = links.findLast((candidate) => candidate !== null) ?? null;
    return [
      ...(bold > 0 ? [{ type: "bold" } as const] : []),
      ...(italic > 0 ? [{ type: "italic" } as const] : []),
      ...(href !== null ? [{ type: "link", href } as const] : []),
    ];
  };

  for (const match of html.matchAll(TOKEN)) {
    const [whole, closing, rawTag, attributes, text] = match;
    if (text !== undefined) {
      const value = decode(text);
      if (value === "") continue;
      if (open === null && value.trim() === "") continue;
      if (open?.kind === "list" && open.item === null && value.trim() === "") continue;
      const target = line();
      const applied = marks();
      if (target.heading && applied.length > 0) lost = true;
      target.content.push(buildVisual.text(value, target.heading ? [] : applied));
      continue;
    }
    if (rawTag === undefined) continue; // a comment
    const tag = rawTag.toLowerCase();
    const heading = HEADINGS.get(tag);
    if (closing) {
      if (heading !== undefined || tag === "p" || tag === "blockquote") {
        if (open?.kind !== "list") close();
      } else if (tag === "ul" || tag === "ol") {
        close();
      } else if (tag === "li") {
        if (open?.kind === "list" && open.item !== null) {
          open.items.push(open.item);
          open.item = null;
        }
      } else if (tag === "strong" || tag === "b") {
        bold = Math.max(0, bold - 1);
      } else if (tag === "em" || tag === "i") {
        italic = Math.max(0, italic - 1);
      } else if (tag === "a") {
        links.pop();
      } else {
        lost = true;
      }
      continue;
    }
    if (heading !== undefined) {
      close();
      open = { kind: "heading", level: heading, content: [] };
    } else if (tag === "p") {
      if (open?.kind !== "list") {
        close();
        open = { kind: "paragraph", content: [] };
      }
    } else if (tag === "blockquote") {
      close();
      open = { kind: "quote", content: [] };
    } else if (tag === "ul" || tag === "ol") {
      close();
      open = { kind: "list", ordered: tag === "ol", items: [], item: null };
    } else if (tag === "li") {
      if (open?.kind !== "list") {
        close();
        open = { kind: "list", ordered: false, items: [], item: null };
      } else if (open.item !== null) {
        open.items.push(open.item);
      }
      open.item = [];
    } else if (tag === "br") {
      const target = line();
      if (target.heading) lost = true;
      else target.content.push(buildVisual.hardBreak());
    } else if (tag === "strong" || tag === "b") {
      bold += 1;
    } else if (tag === "em" || tag === "i") {
      italic += 1;
    } else if (tag === "a") {
      const found = HREF.exec(attributes ?? "");
      const href = found ? decode(found[1] ?? found[2] ?? found[3] ?? "") : null;
      const usable = href !== null && linkAddressProblem(href) === null;
      if (!usable) lost = true;
      links.push(usable ? href : null);
    } else {
      // An element the editor has no block or mark for: its text stays.
      if (whole) lost = true;
    }
  }
  close();

  const document = buildVisual.document(blocks);
  const rendered = renderFreeBody(document);
  return { document, exact: !lost && rendered.ok && rendered.html === html };
}
