/**
 * The Visual document (src/lib/mail-render/visual-document.ts) as tiptap
 * content and back. The editor's schema (schema.ts) has the model's blocks
 * under the model's names, so this is mostly a change of shape: attributes
 * where the model has fields, a button's two link kinds kept apart while the
 * operator switches between them.
 *
 * The way back builds the model's objects in its one key and mark order, so a
 * document the model reads comes out as exactly its source text. It does not
 * check what the operator typed — an image address may be half written — the
 * render does that and says so. Content the model has no place for cannot
 * come from the schema, and is an error here rather than something left out.
 */
import type { JSONContent } from "@tiptap/core";
import { buildVisual, type VisualBlock, type VisualDocument, type VisualInline, type VisualMark } from "@/lib/mail-render/visual-document";

function marksTo(marks: readonly VisualMark[] | undefined): JSONContent["marks"] {
  if (!marks || marks.length === 0) return undefined;
  return marks.map((mark) => (mark.type === "link" ? { type: "link", attrs: { href: mark.href } } : { type: mark.type }));
}

function inlineTo(node: VisualInline): JSONContent {
  if (node.type === "hardBreak") return { type: "hardBreak" };
  const marks = marksTo(node.marks);
  const content: JSONContent =
    node.type === "text" ? { type: "text", text: node.text } : { type: "variable", attrs: { name: node.name } };
  return marks ? { ...content, marks } : content;
}

function blockTo(block: VisualBlock): JSONContent {
  switch (block.type) {
    case "heading":
    case "paragraph": {
      const level = block.type === "heading" && block.level === 3 ? { attrs: { level: 3 } } : {};
      return block.content.length > 0 ? { type: block.type, ...level, content: block.content.map(inlineTo) } : { type: block.type, ...level };
    }
    case "quote":
      return {
        type: "blockquote",
        content: [block.content.length > 0 ? { type: "paragraph", content: block.content.map(inlineTo) } : { type: "paragraph" }],
      };
    case "list":
      return {
        type: block.ordered ? "orderedList" : "bulletList",
        // The schema wants at least one item; an empty list gets a line to type in.
        content: (block.items.length > 0 ? block.items : [[]]).map((item) => ({
          type: "listItem",
          content: [item.length > 0 ? { type: "paragraph", content: item.map(inlineTo) } : { type: "paragraph" }],
        })),
      };
    case "button":
      return {
        type: "button",
        attrs:
          "url" in block.link
            ? { label: block.label, linkKind: "url", url: block.link.url, variable: "" }
            : { label: block.label, linkKind: "variable", url: "", variable: block.link.variable },
      };
    case "image":
      return { type: "image", attrs: { src: block.src, alt: block.alt, width: block.width ?? null } };
    case "divider":
      return { type: "divider" };
    case "conditional":
      return {
        type: "conditional",
        attrs: { variable: block.variable, when: block.when },
        // The schema wants at least one block inside; an empty section gets a line to type in.
        content: block.blocks.length > 0 ? block.blocks.map(blockTo) : [{ type: "paragraph" }],
      };
  }
}

/** A document as the editor's content. */
export function toEditorContent(document: VisualDocument): JSONContent {
  return { type: "doc", content: document.blocks.map(blockTo) };
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

function marksFrom(marks: JSONContent["marks"]): VisualMark[] {
  return (marks ?? []).map((mark): VisualMark => {
    switch (mark.type) {
      case "bold":
      case "italic":
        return { type: mark.type };
      case "link":
        return { type: "link", href: text(mark.attrs?.href) };
      default:
        throw new Error(`Visual editörde bilinmeyen biçim "${mark.type}"`);
    }
  });
}

function inlineFrom(node: JSONContent): VisualInline {
  switch (node.type) {
    case "text":
      return buildVisual.text(text(node.text), marksFrom(node.marks));
    case "variable":
      return buildVisual.variable(text(node.attrs?.name), marksFrom(node.marks));
    case "hardBreak":
      return buildVisual.hardBreak();
    default:
      throw new Error(`Visual editörde bilinmeyen satır içi öğe "${node.type}"`);
  }
}

/** A list item's or a quote's content: the one paragraph the schema lets it hold. */
function oneLine(node: JSONContent, what: string): VisualInline[] {
  const [line, ...more] = node.content ?? [];
  if (more.length > 0 || (line && line.type !== "paragraph")) throw new Error(`Visual editörde ${what} tek paragraf olmalı`);
  return (line?.content ?? []).map(inlineFrom);
}

function itemFrom(node: JSONContent): VisualInline[] {
  if (node.type !== "listItem") throw new Error(`Visual editörde listede bilinmeyen öğe "${node.type}"`);
  return oneLine(node, "liste maddesi");
}

function blockFrom(node: JSONContent): VisualBlock {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "heading":
      return buildVisual.heading((node.content ?? []).map(inlineFrom), attrs.level === 3 ? 3 : undefined);
    case "blockquote":
      return buildVisual.quote(oneLine(node, "alıntı"));
    case "paragraph":
      return buildVisual.paragraph((node.content ?? []).map(inlineFrom));
    case "bulletList":
    case "orderedList":
      return buildVisual.list(node.type === "orderedList", (node.content ?? []).map(itemFrom));
    case "button":
      return buildVisual.button(
        text(attrs.label),
        attrs.linkKind === "variable" ? { variable: text(attrs.variable) } : { url: text(attrs.url) },
      );
    case "image":
      return buildVisual.image(text(attrs.src), text(attrs.alt), typeof attrs.width === "number" ? attrs.width : undefined);
    case "divider":
      return buildVisual.divider();
    case "conditional":
      return buildVisual.conditional(
        text(attrs.variable),
        attrs.when === "unset" ? "unset" : "set",
        (node.content ?? []).map(blockFrom),
      );
    default:
      throw new Error(`Visual editörde bilinmeyen blok "${node.type}"`);
  }
}

/** The editor's content as a document, whether or not what was typed in it passes the model yet. */
export function fromEditorContent(content: JSONContent): VisualDocument {
  return buildVisual.document((content.content ?? []).map(blockFrom));
}
