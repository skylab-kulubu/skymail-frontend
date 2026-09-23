/**
 * A Visual source is a document the Visual editor wrote: versioned JSON of
 * the blocks an operator put together. It is read strictly. The API stores it
 * as jsonb, which keeps neither key order nor spacing, and whatever comes
 * back must either read as the same document or fail loudly — a block, mark
 * or field the panel does not know is never dropped on the way to a render.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  EMPTY_VISUAL_SOURCE,
  parseVisualSource,
  readVisualDocument,
  visualDocumentVariables,
  visualSource,
  type VisualDocument,
} from "./visual-document";

/** One of every block, mark and inline node the model has; the render tests use it too. */
const EVERY_BLOCK = JSON.parse(
  readFileSync(join(import.meta.dirname, "testdata", "visual-every-block.json"), "utf8"),
) as VisualDocument;

/** The same object with every object's keys in reverse order, as jsonb may hand it back. */
function reversedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversedKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, inner]) => [key, reversedKeys(inner)]),
  );
}

function problemsOf(value: unknown): string[] {
  const read = readVisualDocument(value);
  assert.equal(read.ok, false, "belge kabul edildi");
  assert.ok(!read.ok);
  return read.problems;
}

/** EVERY_BLOCK with its blocks replaced. */
const withBlocks = (blocks: unknown[]) => ({ type: "skymail.visual", version: 1, blocks });

describe("a Visual document", () => {
  it("reads back as the same document, whatever order jsonb keeps its keys in", () => {
    const read = readVisualDocument(reversedKeys(EVERY_BLOCK));

    assert.ok(read.ok, read.ok ? "" : read.problems.join("\n"));
    assert.deepEqual(read.document, EVERY_BLOCK);
    assert.equal(visualSource(read.document), visualSource(EVERY_BLOCK));
    assert.equal(visualSource(read.document), JSON.stringify(EVERY_BLOCK));
  });

  it("serialises the same document to the same text, which is what a save compares", () => {
    const text = visualSource(EVERY_BLOCK);
    const parsed = parseVisualSource(text);

    assert.ok(parsed.ok);
    assert.equal(visualSource(parsed.document), text);
  });

  it("puts marks in one order, however they were applied", () => {
    const read = readVisualDocument(
      withBlocks([
        {
          type: "paragraph",
          content: [{ type: "text", text: "önemli", marks: [{ type: "link", href: "https://skyl.app" }, { type: "italic" }, { type: "bold" }] }],
        },
      ]),
    );

    assert.ok(read.ok);
    assert.deepEqual(read.document.blocks[0], {
      type: "paragraph",
      content: [{ type: "text", text: "önemli", marks: [{ type: "bold" }, { type: "italic" }, { type: "link", href: "https://skyl.app" }] }],
    });
  });

  it("starts empty", () => {
    const parsed = parseVisualSource(EMPTY_VISUAL_SOURCE);

    assert.ok(parsed.ok);
    assert.deepEqual(parsed.document, { type: "skymail.visual", version: 1, blocks: [] });
  });

  it("lists the variables it uses: inline, as a button's link and as a condition, nested ones too", () => {
    assert.deepEqual(visualDocumentVariables(EVERY_BLOCK), ["FirstName", "TeamName", "TicketUrl", "Venue"]);
    assert.deepEqual(
      visualDocumentVariables({
        type: "skymail.visual",
        version: 1,
        blocks: [
          {
            type: "conditional",
            variable: "A",
            when: "set",
            blocks: [{ type: "conditional", variable: "B", when: "unset", blocks: [{ type: "button", label: "Git", link: { variable: "C" } }] }],
          },
        ],
      }),
      ["A", "B", "C"],
    );
  });
});

describe("a Visual document that is refused", () => {
  const refused: { name: string; value: unknown; says: RegExp }[] = [
    { name: "something that is not an object", value: [], says: /belge/ },
    { name: "a document of another kind", value: { type: "doc", version: 1, blocks: [] }, says: /skymail\.visual/ },
    { name: "a version this panel does not read", value: { type: "skymail.visual", version: 2, blocks: [] }, says: /sürüm.*2/ },
    { name: "a field the model does not have", value: { type: "skymail.visual", version: 1, blocks: [], theme: "dark" }, says: /theme/ },
    { name: "an unknown block", value: withBlocks([{ type: "quote", content: [] }]), says: /blocks\[0\].*"quote"/ },
    {
      name: "an unknown mark",
      value: withBlocks([{ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "underline" }] }] }]),
      says: /blocks\[0\]\.content\[0\]\.marks\[0\].*"underline"/,
    },
    {
      name: "an unknown inline node",
      value: withBlocks([{ type: "paragraph", content: [{ type: "mention", id: "x" }] }]),
      says: /"mention"/,
    },
    {
      name: "a field a block does not have",
      value: withBlocks([{ type: "divider", color: "#ff0000" }]),
      says: /blocks\[0\].*color/,
    },
    {
      name: "a style on a paragraph",
      value: withBlocks([{ type: "paragraph", content: [], style: { color: "red" } }]),
      says: /style/,
    },
    {
      name: "a mark in a heading",
      value: withBlocks([{ type: "heading", content: [{ type: "text", text: "a", marks: [{ type: "bold" }] }] }]),
      says: /başlık/,
    },
    {
      name: "the same mark twice",
      value: withBlocks([{ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "bold" }, { type: "bold" }] }] }]),
      says: /iki kez/,
    },
    { name: "empty text", value: withBlocks([{ type: "paragraph", content: [{ type: "text", text: "" }] }]), says: /boş/ },
    {
      name: "a variable name the mailer does not accept",
      value: withBlocks([{ type: "paragraph", content: [{ type: "variable", name: "First Name" }] }]),
      says: /First Name/,
    },
    {
      name: "a variable name longer than 64 characters",
      value: withBlocks([{ type: "paragraph", content: [{ type: "variable", name: `A${"b".repeat(64)}` }] }]),
      says: /değişken adı/,
    },
    {
      name: "a button with both a URL and a variable",
      value: withBlocks([{ type: "button", label: "Git", link: { url: "https://skyl.app", variable: "Link" } }]),
      says: /blocks\[0\]\.link/,
    },
    { name: "a button with no link", value: withBlocks([{ type: "button", label: "Git", link: {} }]), says: /blocks\[0\]\.link/ },
    { name: "a button with no label", value: withBlocks([{ type: "button", label: "  ", link: { url: "https://skyl.app" } }]), says: /etiket/ },
    {
      name: "a button to a javascript: address",
      value: withBlocks([{ type: "button", label: "Git", link: { url: "javascript:alert(1)" } }]),
      says: /https/,
    },
    {
      name: "a link with a Go action in its address",
      value: withBlocks([
        { type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "link", href: "https://skyl.app/{{.Id}}" }] }] },
      ]),
      says: /Go aksiyonu/,
    },
    {
      name: "an SVG image",
      value: withBlocks([{ type: "image", src: "https://cdn.yildizskylab.com/logo.svg", alt: "logo" }]),
      says: /SVG/,
    },
    {
      name: "an image that is neither PNG nor JPG",
      value: withBlocks([{ type: "image", src: "https://cdn.yildizskylab.com/afis.gif", alt: "afiş" }]),
      says: /PNG ya da JPG/,
    },
    {
      name: "an image whose address does not say what it is",
      value: withBlocks([{ type: "image", src: "https://cdn.yildizskylab.com/images/fe6b25b5", alt: "afiş" }]),
      says: /PNG ya da JPG/,
    },
    {
      name: "an image over plain http",
      value: withBlocks([{ type: "image", src: "http://cdn.yildizskylab.com/afis.png", alt: "afiş" }]),
      says: /https/,
    },
    {
      name: "an image wider than a mail",
      value: withBlocks([{ type: "image", src: "https://cdn.yildizskylab.com/afis.png", alt: "afiş", width: 2000 }]),
      says: /genişlik/,
    },
    {
      name: "a condition that is neither set nor unset",
      value: withBlocks([{ type: "conditional", variable: "A", when: "equals", blocks: [] }]),
      says: /blocks\[0\]\.when/,
    },
    {
      name: "an unknown block inside a conditional section",
      value: withBlocks([{ type: "conditional", variable: "A", when: "set", blocks: [{ type: "table" }] }]),
      says: /blocks\[0\]\.blocks\[0\].*"table"/,
    },
  ];

  for (const { name, value, says } of refused) {
    it(`refuses ${name}, saying why`, () => {
      const problems = problemsOf(value);
      assert.ok(
        problems.some((problem) => says.test(problem)),
        `${says} bekleniyordu: ${JSON.stringify(problems)}`,
      );
    });
  }

  it("names every problem, not only the first", () => {
    const problems = problemsOf(withBlocks([{ type: "quote" }, { type: "divider", color: "red" }]));
    assert.equal(problems.length, 2, JSON.stringify(problems));
  });

  it("refuses text that is not JSON", () => {
    const parsed = parseVisualSource("{ bozuk");
    assert.equal(parsed.ok, false);
    assert.ok(!parsed.ok);
    assert.match(parsed.problems[0], /JSON/);
  });

  it("accepts an image address with a query after its extension", () => {
    const read = readVisualDocument(withBlocks([{ type: "image", src: "https://cdn.example.com/a.JPG?w=600", alt: "" }]));
    assert.ok(read.ok, read.ok ? "" : read.problems.join("\n"));
  });

  it("will not serialise a document it would refuse to read", () => {
    assert.throws(() => visualSource(withBlocks([{ type: "quote" }]) as unknown as VisualDocument), /quote/);
  });
});
