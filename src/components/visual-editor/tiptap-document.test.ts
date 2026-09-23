/**
 * The Visual editor holds a document as tiptap (ProseMirror) content and hands
 * it back as the render module's Visual document. What it holds must be what
 * the model has, block for block: the editor's schema accepts every document
 * the model reads, and the way back gives the same document, as the same text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getSchema } from "@tiptap/core";
import { TEMPLATE_BODY_ALLOWANCE, visualSource, type VisualDocument } from "@/lib/mail-render/visual-document";
import { visualSchemaExtensions } from "./schema";
import { fromEditorContent, toEditorContent } from "./tiptap-document";

const EVERY_BLOCK = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../lib/mail-render/testdata/visual-every-block.json"), "utf8"),
) as VisualDocument;

const schema = getSchema(visualSchemaExtensions(TEMPLATE_BODY_ALLOWANCE));

/** Content as ProseMirror keeps it: checked against the editor's schema, and back to JSON. */
function throughSchema(document: VisualDocument) {
  const node = schema.nodeFromJSON(toEditorContent(document));
  node.check();
  return node.toJSON();
}

describe("a Visual document in the editor", () => {
  it("fits the editor's schema, every block, mark and variable of it", () => {
    assert.doesNotThrow(() => throughSchema(EVERY_BLOCK));
  });

  it("comes back as the same document, and the same source text", () => {
    const back = fromEditorContent(throughSchema(EVERY_BLOCK));

    assert.deepEqual(back, EVERY_BLOCK);
    assert.equal(JSON.stringify(back), visualSource(EVERY_BLOCK));
  });

  it("starts empty as a single empty paragraph to type in, and an empty paragraph is no content", () => {
    const empty: VisualDocument = { type: "skymail.visual", version: 1, blocks: [] };
    const node = schema.nodeFromJSON(toEditorContent(empty));

    assert.equal(schema.topNodeType.createAndFill()?.childCount, 1);
    assert.deepEqual(fromEditorContent(schema.topNodeType.createAndFill()!.toJSON()), {
      type: "skymail.visual",
      version: 1,
      blocks: [{ type: "paragraph", content: [] }],
    });
    assert.equal(node.type.name, "doc");
  });

  it("keeps a heading free of marks, as the model does", () => {
    const withMark = {
      type: "doc",
      content: [{ type: "heading", content: [{ type: "text", text: "Başlık", marks: [{ type: "bold" }] }] }],
    };
    assert.throws(() => schema.nodeFromJSON(withMark).check());
  });

  it("has no node or mark the model does not", () => {
    assert.deepEqual(Object.keys(schema.nodes).sort(), [
      "button",
      "conditional",
      "divider",
      "doc",
      "heading",
      "image",
      "paragraph",
      "text",
      "variable",
    ]);
    assert.deepEqual(Object.keys(schema.marks).sort(), ["bold", "italic", "link"]);
  });

  it("refuses content it does not know rather than leave it out", () => {
    assert.throws(
      () => fromEditorContent({ type: "doc", content: [{ type: "codeBlock", content: [] }] }),
      /codeBlock/,
    );
    assert.throws(
      () => fromEditorContent({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "strike" }] }] }] }),
      /strike/,
    );
  });

  it("reads a button's link from the kind chosen, keeping the other only while editing", () => {
    const document = fromEditorContent({
      type: "doc",
      content: [
        { type: "button", attrs: { label: "Git", linkKind: "variable", url: "https://skyl.app", variable: "TicketUrl" } },
        { type: "button", attrs: { label: "Git", linkKind: "url", url: "https://skyl.app", variable: "TicketUrl" } },
      ],
    });
    assert.deepEqual(document.blocks, [
      { type: "button", label: "Git", link: { variable: "TicketUrl" } },
      { type: "button", label: "Git", link: { url: "https://skyl.app" } },
    ]);
  });
});

describe("the editor for a narrower allowance", () => {
  it("has only the blocks and marks allowed, so nothing else can be typed or pasted in", () => {
    const narrow = getSchema(
      visualSchemaExtensions({
        blocks: ["heading", "paragraph", "button"],
        marks: ["bold", "italic"],
        variables: false,
        lineBreaks: false,
        subheadings: false,
      }),
    );

    assert.deepEqual(Object.keys(narrow.nodes).sort(), ["button", "doc", "heading", "paragraph", "text"]);
    assert.deepEqual(Object.keys(narrow.marks).sort(), ["bold", "italic"]);
  });
});

// A free announcement's body (ticket 16): lists, line breaks, quotes and
// sub-headings, as the markdown it replaced had; a list item and a quote are
// one paragraph each, never a nested block.
describe("the editor for a free announcement's body", () => {
  const announcement = getSchema(
    visualSchemaExtensions({
      blocks: ["heading", "paragraph", "list", "quote"],
      marks: ["bold", "italic", "link"],
      variables: false,
      lineBreaks: true,
      subheadings: true,
    }),
  );
  const document: VisualDocument = {
    type: "skymail.visual",
    version: 1,
    blocks: [
      { type: "heading", content: [{ type: "text", text: "Duyuru" }] },
      { type: "heading", level: 3, content: [{ type: "text", text: "Program" }] },
      { type: "quote", content: [{ type: "text", text: "Alıntı", marks: [{ type: "italic" }] }, { type: "hardBreak" }, { type: "text", text: "— Ada" }] },
      { type: "paragraph", content: [{ type: "text", text: "Birinci" }, { type: "hardBreak" }, { type: "text", text: "ikinci", marks: [{ type: "bold" }] }] },
      { type: "list", ordered: false, items: [[{ type: "text", text: "12–13 Nisan" }], []] },
      { type: "list", ordered: true, items: [[{ type: "text", text: "Başvur" }, { type: "hardBreak" }, { type: "text", text: "Bekle" }]] },
    ],
  };

  it("has lists, line breaks and quotes, and no block the template's editor has that the server drops", () => {
    assert.deepEqual(Object.keys(announcement.nodes).sort(), [
      "blockquote",
      "bulletList",
      "doc",
      "hardBreak",
      "heading",
      "listItem",
      "orderedList",
      "paragraph",
      "text",
    ]);
  });

  it("holds a list, a line break, a quote and a sub-heading, and gives them back as the same document", () => {
    const node = announcement.nodeFromJSON(toEditorContent(document));
    node.check();
    assert.deepEqual(fromEditorContent(node.toJSON()), document);
    assert.equal(JSON.stringify(fromEditorContent(node.toJSON())), JSON.stringify(document));
  });

  it("keeps a quote to one paragraph", () => {
    const twice = { type: "doc", content: [{ type: "blockquote", content: [{ type: "paragraph" }, { type: "paragraph" }] }] };
    assert.throws(() => announcement.nodeFromJSON(twice).check());
  });

  it("keeps a list item to one line of text: no list inside it", () => {
    const nested = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph" }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] }] }],
        },
      ],
    };
    assert.throws(() => announcement.nodeFromJSON(nested).check());
  });
});

