/**
 * Visual mode: a document of blocks becomes mail through the club's own mail
 * components (emails/theme.tsx) and nothing else, so a mail an operator puts
 * together without code carries the house look — dark theme and opaque
 * surfaces included — by construction. Its variables and conditions become Go
 * template actions, which the mailer fills per send and so must come out
 * exactly as written.
 *
 * The checks emails:render holds the repo's templates to only ever see the
 * repo's templates; a document someone writes tomorrow is safe because of how
 * blocks render, which these tests pin, and the checks run here on a document
 * that uses every block.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  checkBackgroundLayersAreThemed,
  checkBalancedActions,
  checkOpaqueSurfaces,
  checkPlainTextIsReadable,
  checkSubjectVariables,
} from "../../../scripts/mail-checks";
import { blockBalance, fillSampleValues, referencedVariables, renderSource, type Rendered } from ".";
import { findActions } from "./go-template";
import {
  visualDocumentVariables,
  visualSource,
  type VisualBlock,
  type VisualDocument,
  type VisualInline,
} from "./visual-document";

const EVERY_BLOCK = JSON.parse(
  readFileSync(join(import.meta.dirname, "testdata", "visual-every-block.json"), "utf8"),
) as VisualDocument;

const documentOf = (blocks: VisualBlock[]): VisualDocument => ({ type: "skymail.visual", version: 1, blocks });

/** The action that prints one `{`: how a brace the operator typed is written. */
const TYPED_BRACE = "{{`{`}}";

/** The text of the hidden line an inbox shows beside the subject, before its padding, as a client reads its whitespace. */
function previewLineOf(html: string): string {
  const match = /data-skip-in-text="true">([^<]*)</.exec(html);
  assert.ok(match, "önizleme satırı yok");
  return match[1].replace(/\s+/g, " ").trim();
}

async function renderVisual(document: VisualDocument): Promise<Rendered> {
  const result = await renderSource({ mode: "visual", source: visualSource(document) });
  assert.equal(result.ok, true, result.ok ? "" : result.message);
  assert.ok(result.ok);
  return result;
}

/** A mail a JSX author would write with the house components, rendered in JSX mode. */
async function renderHouseJsx(preview: string, body: string): Promise<Rendered> {
  const source = `import * as React from "react";
import { Cta, Divider, Em, Figure, Heading, Paragraph, Shell, Strong, TextLink } from "./theme";
import { end, ifNotSet, ifSet, v } from "./go";

export default function Mail() {
  return (
    <Shell preview={${JSON.stringify(preview)}}>
      ${body}
    </Shell>
  );
}
`;
  const result = await renderSource({ mode: "jsx", source });
  assert.equal(result.ok, true, result.ok ? "" : result.message);
  assert.ok(result.ok);
  return result;
}

describe("each Visual block is a house mail component", () => {
  const cases: { name: string; blocks: VisualBlock[]; preview: string; jsx: string }[] = [
    {
      name: "a heading is the house Heading, its variable an action",
      blocks: [{ type: "heading", content: [{ type: "text", text: "Merhaba " }, { type: "variable", name: "FirstName" }] }],
      preview: "Merhaba {{.FirstName}}",
      jsx: `<Heading>{"Merhaba "}{v("FirstName")}</Heading>`,
    },
    {
      name: "a heading after other blocks keeps the house Heading, spaced from what is above it",
      blocks: [
        { type: "paragraph", content: [{ type: "text", text: "Giriş" }] },
        { type: "heading", content: [{ type: "text", text: "Program" }] },
      ],
      preview: "Giriş",
      jsx: `<Paragraph>{"Giriş"}</Paragraph><Heading spaced>{"Program"}</Heading>`,
    },
    {
      name: "a paragraph is the house Paragraph; bold is Strong, a link TextLink",
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Kayıt " },
            { type: "text", text: "açık", marks: [{ type: "bold" }] },
            { type: "text", text: ", " },
            { type: "text", text: "yarın", marks: [{ type: "italic" }] },
            { type: "text", text: " kapanıyor: " },
            { type: "text", text: "başvur", marks: [{ type: "bold" }, { type: "link", href: "https://skyl.app/basvuru" }] },
            { type: "text", text: ". " },
            { type: "variable", name: "TeamName", marks: [{ type: "italic" }] },
          ],
        },
      ],
      preview: "Kayıt açık, yarın kapanıyor: başvur. {{.TeamName}}",
      jsx: `<Paragraph>{"Kayıt "}<Strong>{"açık"}</Strong>{", "}<Em>{"yarın"}</Em>{" kapanıyor: "}<Strong><TextLink href="https://skyl.app/basvuru">{"başvur"}</TextLink></Strong>{". "}<Em>{v("TeamName")}</Em></Paragraph>`,
    },
    {
      name: "a button to an address is the house Cta",
      blocks: [{ type: "button", label: "Programı gör", link: { url: "https://skyl.app/program" } }],
      preview: "",
      jsx: `<Cta href="https://skyl.app/program">{"Programı gör"}</Cta>`,
    },
    {
      // A variable that comes empty must not leave a button to nowhere (free.basic does this by hand).
      name: "a button to a variable is the house Cta, shown only when the variable is set",
      blocks: [{ type: "button", label: "Bilete git", link: { variable: "TicketUrl" } }],
      preview: "",
      jsx: `{ifSet("TicketUrl")}<Cta href={v("TicketUrl")}>{"Bilete git"}</Cta>{end}`,
    },
    {
      name: "an image is the house Figure",
      blocks: [{ type: "image", src: "https://cdn.yildizskylab.com/afis.png", alt: "Afiş", width: 320 }],
      preview: "",
      jsx: `<Figure src="https://cdn.yildizskylab.com/afis.png" alt="Afiş" width={320} />`,
    },
    {
      name: "a divider is the house Divider",
      blocks: [{ type: "divider" }],
      preview: "",
      jsx: `<Divider />`,
    },
    {
      name: "a section for when a variable is set is an if",
      blocks: [
        {
          type: "conditional",
          variable: "Venue",
          when: "set",
          blocks: [{ type: "paragraph", content: [{ type: "text", text: "Yer: " }, { type: "variable", name: "Venue" }] }],
        },
      ],
      preview: "",
      jsx: `{ifSet("Venue")}<Paragraph>{"Yer: "}{v("Venue")}</Paragraph>{end}`,
    },
    {
      name: "a section for when a variable is not set is an if not",
      blocks: [
        {
          type: "conditional",
          variable: "Venue",
          when: "unset",
          blocks: [{ type: "paragraph", content: [{ type: "text", text: "Yer yakında duyurulacak." }] }],
        },
      ],
      preview: "",
      jsx: `{ifNotSet("Venue")}<Paragraph>{"Yer yakında duyurulacak."}</Paragraph>{end}`,
    },
  ];

  for (const { name, blocks, preview, jsx } of cases) {
    it(name, async () => {
      const visual = await renderVisual(documentOf(blocks));
      const house = await renderHouseJsx(preview, jsx);

      assert.equal(visual.html, house.html);
      assert.equal(visual.plainText, house.plainText);
    });
  }
});

describe("a Visual document rendered", () => {
  it("keeps each Go action it writes, byte for byte, in both bodies", async () => {
    const { html, plainText } = await renderVisual(EVERY_BLOCK);

    for (const action of ["{{.FirstName}}", "{{.TeamName}}", "{{if .TicketUrl}}", "{{.TicketUrl}}", "{{if .Venue}}", "{{.Venue}}", "{{if not .Venue}}", "{{end}}"]) {
      assert.ok(html.includes(action), `HTML'de ${action} yok`);
      assert.ok(plainText.includes(action), `düz metinde ${action} yok: ${plainText}`);
    }
    assert.ok(html.includes('href="{{.TicketUrl}}"'));
    assert.deepEqual(blockBalance(html), { opens: 3, ends: 3 });
  });

  it("keeps an action whole even when its variable's name is as long as the mailer allows", async () => {
    const name = `A${"b".repeat(63)}`;
    const { html, plainText } = await renderVisual(
      documentOf([
        {
          type: "conditional",
          variable: name,
          when: "unset",
          blocks: [{ type: "button", label: "Git", link: { variable: name } }],
        },
      ]),
    );

    for (const action of [`{{if not .${name}}}`, `{{if .${name}}}`, `{{.${name}}}`]) {
      assert.ok(html.includes(action), `HTML'de ${action} yok`);
      assert.ok(plainText.includes(action), `düz metinde ${action} yok`);
    }
  });

  it("references the variables the document uses, as the server's reading of the body counts them", async () => {
    const rendered = await renderVisual(EVERY_BLOCK);

    assert.deepEqual(rendered.variables, visualDocumentVariables(EVERY_BLOCK));
    assert.deepEqual(rendered.variables, referencedVariables(rendered.html));
    assert.deepEqual(referencedVariables(rendered.plainText), rendered.variables);
  });

  it("writes its plain-text part from the same blocks", async () => {
    const { plainText } = await renderVisual(
      documentOf([
        { type: "heading", content: [{ type: "text", text: "Merhaba " }, { type: "variable", name: "FirstName" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ayrıntılar " },
            { type: "text", text: "burada", marks: [{ type: "link", href: "https://skyl.app/e/1" }] },
            { type: "text", text: "." },
          ],
        },
        { type: "button", label: "Bilete git", link: { variable: "TicketUrl" } },
        { type: "divider" },
        {
          type: "conditional",
          variable: "Venue",
          when: "unset",
          blocks: [{ type: "paragraph", content: [{ type: "text", text: "Yer yakında duyurulacak." }] }],
        },
      ]),
    );

    // The Shell's footer follows; it is the same in every mail.
    const body = plainText.slice(0, plainText.indexOf("SKY LAB https://yildizskylab.com")).trim();
    assert.equal(
      body,
      [
        "Merhaba {{.FirstName}}",
        "",
        "Ayrıntılar burada https://skyl.app/e/1.",
        "",
        "{{if .TicketUrl}}",
        "",
        "Bilete git {{.TicketUrl}}",
        "",
        "{{end}}",
        "",
        "----------------------------------------",
        "",
        "{{if not .Venue}}",
        "",
        "Yer yakında duyurulacak.",
        "",
        "{{end}}",
      ].join("\n"),
    );
  });

  // Typed text is only ever text. A brace an operator typed must not meet
  // another — in the same node, or across nodes whose marks the plain text and
  // the preview line drop — and open an action: `Kod {{{.Code}}}` does not
  // parse (html/template: unexpected "{" in command), and `a{{.X}} b` is a
  // live action nobody wrote.
  const adversarial: { name: string; blocks: VisualBlock[]; meant: string[] }[] = [
    {
      name: "a brace just before a variable",
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Kod {" }, { type: "variable", name: "Code" }, { type: "text", text: "}" }],
        },
      ],
      meant: ["{{.Code}}"],
    },
    {
      name: "a brace ending one styled piece and one starting the next",
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a{", marks: [{ type: "bold" }] },
            { type: "text", text: "{.X}} b" },
          ],
        },
      ],
      meant: [],
    },
    {
      name: "braces ending the opening line and starting a variable's neighbour",
      blocks: [
        {
          type: "heading",
          content: [{ type: "text", text: "{" }, { type: "text", text: "{{if .A}}" }, { type: "variable", name: "Name" }, { type: "text", text: "{" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "{.B}}", marks: [{ type: "link", href: "https://skyl.app" }] }] },
      ],
      meant: ["{{.Name}}"],
    },
    {
      name: "text that looks like actions, in text, a label and an image description",
      blocks: [
        { type: "paragraph", content: [{ type: "text", text: "Şablonda {{.Ad}} ya da {{ yazılır; {{end}}" }] },
        { type: "button", label: "{{end}}{", link: { url: "https://skyl.app" } },
        { type: "image", src: "https://cdn.yildizskylab.com/images/afis", alt: "{{if .X}}{" },
        { type: "button", label: "{", link: { variable: "Link" } },
      ],
      meant: ["{{if .Link}}", "{{.Link}}", "{{end}}"],
    },
  ];

  for (const { name, blocks, meant } of adversarial) {
    it(`writes typed text as text: ${name}`, async () => {
      const rendered = await renderVisual(documentOf(blocks));

      for (const [body, text] of [
        ["HTML", rendered.html],
        ["düz metin", rendered.plainText],
        ["önizleme satırı", previewLineOf(rendered.html)],
      ]) {
        const actions = findActions(text)
          .map(({ start, end }) => text.slice(start, end))
          .filter((action) => action !== TYPED_BRACE);
        assert.deepEqual(
          actions.filter((action) => !meant.includes(action)),
          [],
          `${body}: kimsenin yazmadığı aksiyon: ${text}`,
        );
        // The HTML repeats the opening line in its hidden preview line; the preview line has only that line.
        if (body !== "önizleme satırı") assert.deepEqual([...new Set(actions)], meant, `${body}: ${text}`);
        assert.ok(!text.includes("{{{"), `${body}'de üç süslü parantez: ${text}`);
      }
      const variables = meant.flatMap((action) => referencedVariables(action));
      assert.deepEqual(rendered.variables, [...new Set(variables)].sort());
      assert.deepEqual(referencedVariables(rendered.plainText), rendered.variables);
    });
  }

  it("prints what the operator typed, once the mailer fills it", async () => {
    const { html } = await renderVisual(documentOf([{ type: "paragraph", content: [{ type: "text", text: "Şablonda {{.Ad}} yazılır" }] }]));
    assert.ok(html.includes(`Şablonda ${TYPED_BRACE}${TYPED_BRACE}.Ad}} yazılır`), html);
    assert.match(fillSampleValues(html, {}), /Şablonda \{\{\.Ad\}\} yazılır/);
  });

  it("starts the preview line of an inbox with its first heading or paragraph", async () => {
    const { html } = await renderVisual(EVERY_BLOCK);
    assert.equal(previewLineOf(html), "Merhaba {{.FirstName}}");
  });

  // React Email keeps the first 150 characters of a preview line and drops
  // the rest, wherever that falls: inside an action, the mailer could not
  // parse the mail, and no check of emails:render would have noticed.
  for (const [name, content] of [
    ["a variable", [{ type: "text", text: "a".repeat(140) }, { type: "variable", name: "FirstName" }, { type: "text", text: " sonra" }]],
    ["a typed brace", [{ type: "text", text: `${"a".repeat(146)}{ sonra` }]],
  ] as [string, VisualInline[]][]) {
    it(`does not cut ${name} in half to fit the preview line`, async () => {
      const { html } = await renderVisual(documentOf([{ type: "paragraph", content }]));
      const line = previewLineOf(html);
      let outside = line;
      for (const { start, end } of findActions(line).reverse()) outside = outside.slice(0, start) + outside.slice(end);

      assert.ok(line.length <= 150, `${line.length} karakter`);
      assert.ok(!/[{}]/.test(outside), `önizleme satırında yarım aksiyon: ${line}`);
      assert.deepEqual(blockBalance(html), { opens: 0, ends: 0 });
    });
  }

  it("keeps a typed brace in the preview line when the whole of it fits", async () => {
    const { html } = await renderVisual(documentOf([{ type: "paragraph", content: [{ type: "text", text: `${"a".repeat(140)}{ sonra` }] }]));
    assert.equal(previewLineOf(html), `${"a".repeat(140)}${TYPED_BRACE} so`);
  });

  it("passes every check emails:render holds the repo's templates to, dark theme included", async () => {
    const { html, plainText, variables } = await renderVisual(EVERY_BLOCK);
    const problems: string[] = [];

    checkBalancedActions("visual", html, problems);
    checkOpaqueSurfaces("visual", html, problems);
    checkBackgroundLayersAreThemed("visual", html, problems);
    checkPlainTextIsReadable("visual", html, plainText, problems);
    checkSubjectVariables("visual", "{{.FirstName}}, GECEKODU'nda görüşelim", variables, problems);

    assert.deepEqual(problems, []);
    assert.match(html, /@media \(prefers-color-scheme: dark\)/);
    assert.match(html, /class="card"/);
  });
});

describe("a Visual source that does not render", () => {
  for (const [name, blocks] of [
    ["with no blocks", []],
    ["with only empty paragraphs and headings", [{ type: "paragraph", content: [] }, { type: "heading", content: [] }]],
    ["with only an empty conditional section", [{ type: "conditional", variable: "A", when: "set", blocks: [] }]],
  ] as [string, VisualBlock[]][]) {
    it(`is empty ${name}`, async () => {
      const result = await renderSource({ mode: "visual", source: visualSource(documentOf(blocks)) });

      assert.ok(!result.ok);
      assert.equal(result.reason, "empty");
    });
  }

  it("is invalid when a block is one the model does not know, and says which", async () => {
    const result = await renderSource({
      mode: "visual",
      source: JSON.stringify({ type: "skymail.visual", version: 1, blocks: [{ type: "html", html: "<script>" }] }),
    });

    assert.ok(!result.ok);
    assert.equal(result.reason, "invalid");
    assert.match(result.message, /"html"/);
  });

  it("is invalid when an image is an SVG", async () => {
    const result = await renderSource({
      mode: "visual",
      source: JSON.stringify(documentOf([{ type: "image", src: "https://cdn.yildizskylab.com/logo.svg", alt: "logo" }])),
    });

    assert.ok(!result.ok);
    assert.equal(result.reason, "invalid");
    assert.match(result.message, /SVG/);
  });

  it("is invalid when it is not JSON", async () => {
    const result = await renderSource({ mode: "visual", source: "<p>HTML değil</p>" });

    assert.ok(!result.ok);
    assert.equal(result.reason, "invalid");
  });
});
