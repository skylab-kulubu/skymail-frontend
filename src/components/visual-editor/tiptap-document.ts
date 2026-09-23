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
import {
  VISUAL_DOCUMENT_TYPE,
  VISUAL_DOCUMENT_VERSION,
  type VisualBlock,
  type VisualDocument,
  type VisualInline,
  type VisualMark,
} from "@/lib/mail-render/visual-document";

const MARK_ORDER: readonly VisualMark["type"][] = ["bold", "italic", "link"];

function marksTo(marks: readonly VisualMark[] | undefined): JSONContent["marks"] {
  if (!marks || marks.length === 0) return undefined;
  return marks.map((mark) => (mark.type === "link" ? { type: "link", attrs: { href: mark.href } } : { type: mark.type }));
}

function inlineTo(node: VisualInline): JSONContent {
  const marks = marksTo(node.marks);
  const content: JSONContent =
    node.type === "text" ? { type: "text", text: node.text } : { type: "variable", attrs: { name: node.name } };
  return marks ? { ...content, marks } : content;
}

function blockTo(block: VisualBlock): JSONContent {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return block.content.length > 0 ? { type: block.type, content: block.content.map(inlineTo) } : { type: block.type };
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

function marksFrom(marks: JSONContent["marks"]): { marks?: VisualMark[] } {
  if (!marks || marks.length === 0) return {};
  const read = marks.map((mark): VisualMark => {
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
  return { marks: read.sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type)) };
}

function inlineFrom(node: JSONContent): VisualInline {
  switch (node.type) {
    case "text":
      return { type: "text", text: text(node.text), ...marksFrom(node.marks) };
    case "variable":
      return { type: "variable", name: text(node.attrs?.name), ...marksFrom(node.marks) };
    default:
      throw new Error(`Visual editörde bilinmeyen satır içi öğe "${node.type}"`);
  }
}

function blockFrom(node: JSONContent): VisualBlock {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "heading":
    case "paragraph":
      return { type: node.type, content: (node.content ?? []).map(inlineFrom) };
    case "button":
      return {
        type: "button",
        label: text(attrs.label),
        link: attrs.linkKind === "variable" ? { variable: text(attrs.variable) } : { url: text(attrs.url) },
      };
    case "image":
      return {
        type: "image",
        src: text(attrs.src),
        alt: text(attrs.alt),
        ...(typeof attrs.width === "number" ? { width: attrs.width } : {}),
      };
    case "divider":
      return { type: "divider" };
    case "conditional":
      return {
        type: "conditional",
        variable: text(attrs.variable),
        when: attrs.when === "unset" ? "unset" : "set",
        blocks: (node.content ?? []).map(blockFrom),
      };
    default:
      throw new Error(`Visual editörde bilinmeyen blok "${node.type}"`);
  }
}

/** The editor's content as a document, whether or not what was typed in it passes the model yet. */
export function fromEditorContent(content: JSONContent): VisualDocument {
  return {
    type: VISUAL_DOCUMENT_TYPE,
    version: VISUAL_DOCUMENT_VERSION,
    blocks: (content.content ?? []).map(blockFrom),
  };
}
