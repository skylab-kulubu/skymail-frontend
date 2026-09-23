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
  TEMPLATE_BODY_ALLOWANCE,
  parseVisualSource,
  readVisualDocument,
  visualDocumentVariables,
  visualSource,
  type VisualAllowance,
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
      name: "an SVG image on the club CDN too",
      value: withBlocks([{ type: "image", src: "https://cdn.yildizskylab.com/images/logo.svgz", alt: "logo" }]),
      says: /SVG/,
    },
    {
      name: "a WebP image",
      value: withBlocks([{ type: "image", src: "https://example.com/afis.webp?w=600", alt: "afiş" }]),
      says: /WebP.*Outlook/,
    },
    {
      name: "an image elsewhere whose address does not say what it is",
      value: withBlocks([{ type: "image", src: "https://example.com/images/fe6b25b5", alt: "afiş" }]),
      says: /\.png, \.jpg, \.jpeg ya da \.gif/,
    },
    {
      name: "an image elsewhere that is neither PNG, JPG nor GIF",
      value: withBlocks([{ type: "image", src: "https://example.com/afis.bmp", alt: "afiş" }]),
      says: /\.png, \.jpg, \.jpeg ya da \.gif/,
    },
    {
      name: "an image over plain http",
      value: withBlocks([{ type: "image", src: "http://cdn.yildizskylab.com/afis.png", alt: "afiş" }]),
      says: /https/,
    },
    {
      name: "an image written into the mail as data",
      value: withBlocks([{ type: "image", src: "data:image/png;base64,iVBORw0KGgo=", alt: "afiş" }]),
      says: /data:/,
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

  for (const [name, src] of [
    ["the club CDN's, which names no extension (the mails' own logo)", "https://cdn.yildizskylab.com/images/fe6b25b5-6dc6-4981-ab09-907b304f369a"],
    ["another host's PNG, with a query after its extension", "https://cdn.example.com/a.PNG?w=600"],
    ["another host's JPG", "https://example.com/afis.jpeg"],
    ["another host's GIF", "https://example.com/afis.gif"],
  ]) {
    it(`accepts an image address: ${name}`, () => {
      const read = readVisualDocument(withBlocks([{ type: "image", src, alt: "" }]));
      assert.ok(read.ok, read.ok ? "" : read.problems.join("\n"));
    });
  }

  it("will not serialise a document it would refuse to read", () => {
    assert.throws(() => visualSource(withBlocks([{ type: "quote" }]) as unknown as VisualDocument), /quote/);
  });
});

// A body that goes through another gate — ticket 16's free announcement,
// which the server's allow-list sanitizes — may use less of the model. The
// reader refuses what a narrower allowance leaves out, as the editor offers
// only what it allows.
describe("a Visual document read with a narrower allowance", () => {
  const plain: VisualAllowance = { blocks: ["heading", "paragraph", "button"], marks: ["bold", "italic"], variables: false, lineBreaks: false };

  it("reads what the allowance keeps", () => {
    const read = readVisualDocument(
      withBlocks([
        { type: "heading", content: [{ type: "text", text: "Duyuru" }] },
        { type: "paragraph", content: [{ type: "text", text: "kalın", marks: [{ type: "bold" }] }] },
        { type: "button", label: "Git", link: { url: "https://skyl.app" } },
      ]),
      plain,
    );
    assert.ok(read.ok, read.ok ? "" : read.problems.join("\n"));
  });

  for (const [name, block, says] of [
    ["an image", { type: "image", src: "https://cdn.yildizskylab.com/images/a", alt: "" }, /blocks\[0\]: "image" bloğu burada kullanılamaz/],
    ["a divider", { type: "divider" }, /"divider" bloğu burada kullanılamaz/],
    ["a conditional section", { type: "conditional", variable: "A", when: "set", blocks: [] }, /"conditional" bloğu burada kullanılamaz/],
    ["a link", { type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "link", href: "https://skyl.app" }] }] }, /marks\[0\]: "link" biçimi burada kullanılamaz/],
    ["an inline variable", { type: "paragraph", content: [{ type: "variable", name: "FirstName" }] }, /content\[0\]: değişken burada kullanılamaz/],
    ["a button to a variable", { type: "button", label: "Git", link: { variable: "Link" } }, /blocks\[0\]\.link: bağlantı burada bir değişken olamaz/],
  ] as [string, unknown, RegExp][]) {
    it(`refuses ${name}, saying it is not used here`, () => {
      const read = readVisualDocument(withBlocks([block]), plain);
      assert.equal(read.ok, false);
      assert.ok(!read.ok && read.problems.some((problem) => says.test(problem)), JSON.stringify(!read.ok && read.problems));
    });
  }

  it("is everything for a Mail template's own body", () => {
    assert.ok(readVisualDocument(EVERY_BLOCK, TEMPLATE_BODY_ALLOWANCE).ok);
    assert.equal(parseVisualSource(visualSource(EVERY_BLOCK), plain).ok, false);
  });
});

// A free announcement's body (ticket 16) has lists and line breaks, as the
// markdown it replaces had; a Mail template's body does not, since the club's
// mail components draw neither yet.
describe("a list and a line break", () => {
  const announcement: VisualAllowance = {
    blocks: ["heading", "paragraph", "list"],
    marks: ["bold", "italic", "link"],
    variables: false,
    lineBreaks: true,
  };
  const list = {
    type: "list",
    ordered: false,
    items: [
      [{ type: "text", text: "12–13 Nisan" }],
      [{ type: "text", text: "Davutpaşa", marks: [{ type: "bold" }] }, { type: "hardBreak" }, { type: "text", text: "D-Blok" }],
    ],
  };
  const broken = { type: "paragraph", content: [{ type: "text", text: "Birinci satır" }, { type: "hardBreak" }, { type: "text", text: "ikinci satır" }] };

  it("read where the allowance has them, keys in their one order", () => {
    const read = readVisualDocument(reversedKeys(withBlocks([list, broken, { ...list, ordered: true }])), announcement);
    assert.ok(read.ok, read.ok ? "" : read.problems.join("\n"));
    assert.equal(JSON.stringify(read.document.blocks[0]), JSON.stringify(list));
    assert.equal(JSON.stringify(read.document.blocks[1]), JSON.stringify(broken));
    assert.equal(visualSource(read.document), JSON.stringify(withBlocks([list, broken, { ...list, ordered: true }])));
  });

  it("are not a Mail template's: its body refuses them, saying they are not used here", () => {
    const read = readVisualDocument(withBlocks([list, broken]), TEMPLATE_BODY_ALLOWANCE);
    assert.ok(!read.ok);
    assert.deepEqual(read.problems, ['blocks[0]: "list" bloğu burada kullanılamaz', "blocks[1].content[1]: satır sonu burada kullanılamaz"]);
  });

  it("keep a heading on one line, and say what is wrong with a list", () => {
    const read = readVisualDocument(
      withBlocks([
        { type: "heading", content: [{ type: "text", text: "a" }, { type: "hardBreak" }] },
        { type: "list", ordered: "evet", items: [] },
        { type: "list", ordered: true, items: "a" },
        { type: "list", ordered: true, items: [[{ type: "hardBreak", marks: [] }]] },
      ]),
      announcement,
    );
    assert.ok(!read.ok);
    assert.deepEqual(read.problems, [
      "blocks[0].content[1]: başlıkta satır sonu olmaz",
      'blocks[1].ordered: numaralı (true) ya da madde işaretli (false) olmalı',
      "blocks[2].items: maddeler bir liste olmalı",
      'blocks[3].items[0][0]: bilinmeyen alan "marks"',
    ]);
  });
});

