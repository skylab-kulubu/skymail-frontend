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
import { blockBalance, referencedVariables, renderSource, type Rendered } from ".";
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

/** The text of the hidden line an inbox shows beside the subject, before its padding. */
function previewLineOf(html: string): string {
  const match = /data-skip-in-text="true">([^<]*)</.exec(html);
  assert.ok(match, "önizleme satırı yok");
  return match[1].trim();
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
import { Cta, Divider, Figure, Heading, Paragraph, Shell, Strong, TextLink } from "./theme";
import { end, v } from "./go";

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
      jsx: `<Paragraph>{"Giriş"}</Paragraph><Heading style={{ marginTop: "28px" }}>{"Program"}</Heading>`,
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
      jsx: `<Paragraph>{"Kayıt "}<Strong>{"açık"}</Strong>{", "}<em>{"yarın"}</em>{" kapanıyor: "}<Strong><TextLink href="https://skyl.app/basvuru">{"başvur"}</TextLink></Strong>{". "}<em>{v("TeamName")}</em></Paragraph>`,
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
      jsx: `{"{{if .TicketUrl}}"}<Cta href={v("TicketUrl")}>{"Bilete git"}</Cta>{end}`,
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
      jsx: `{"{{if .Venue}}"}<Paragraph>{"Yer: "}{v("Venue")}</Paragraph>{end}`,
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
      jsx: `{"{{if not .Venue}}"}<Paragraph>{"Yer yakında duyurulacak."}</Paragraph>{end}`,
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

  it("writes what an operator typed as text, even text that looks like a Go action", async () => {
    const rendered = await renderVisual(
      documentOf([
        { type: "paragraph", content: [{ type: "text", text: "Şablonda {{.Ad}} ya da {{ yazılır." }] },
        { type: "button", label: "{{end}}", link: { url: "https://skyl.app" } },
        { type: "image", src: "https://cdn.yildizskylab.com/a.png", alt: "{{if .X}}" },
      ]),
    );

    assert.deepEqual(rendered.variables, []);
    assert.deepEqual(blockBalance(rendered.html), { opens: 0, ends: 0 });
    assert.deepEqual(blockBalance(rendered.plainText), { opens: 0, ends: 0 });
    // The mailer prints `{{`{{`}}` as the two braces the operator typed.
    assert.ok(rendered.html.includes("Şablonda {{`{{`}}.Ad}} ya da {{`{{`}} yazılır."), rendered.html);
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
    ["typed braces", [{ type: "text", text: `${"a".repeat(145)}{{ sonra` }]],
  ] as [string, VisualInline[]][]) {
    it(`does not cut ${name} in half to fit the preview line`, async () => {
      const { html } = await renderVisual(documentOf([{ type: "paragraph", content }]));
      const line = previewLineOf(html);

      assert.ok(line.length <= 150, `${line.length} karakter`);
      assert.equal(line, "a".repeat(line.length), `önizleme satırında yarım aksiyon: ${line}`);
      assert.deepEqual(blockBalance(html), { opens: 0, ends: 0 });
    });
  }

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
