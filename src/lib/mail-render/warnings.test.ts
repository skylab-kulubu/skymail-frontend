/**
 * What a render may still get wrong, said with the render rather than
 * refused. A link whose address runs straight into the next word in the plain
 * text is one: emails:render fails a repo template for it, but an operator's
 * text in any mode is the operator's to fix, so the editor says it — next to
 * the preview and again before publishing — and does not stop the save.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderSource, type SourceInput } from ".";
import { renderWarnings } from "./warnings";

const GLUED = "Bağlantıdan sonra bir boşluk bırak: düz metinde bağlantı ile sonraki kelime birleşiyor (https://skyl.app/edan öğren.).";

const glued: SourceInput[] = [
  { mode: "html", source: '<p>Ayrıntılar <a href="https://skyl.app/e">burada</a>dan öğren.</p>' },
  {
    mode: "jsx",
    source:
      'import { Paragraph, Shell, TextLink } from "./theme";\nexport default () => <Shell preview=""><Paragraph>Ayrıntılar <TextLink href="https://skyl.app/e">burada</TextLink>dan öğren.</Paragraph></Shell>;',
  },
  {
    mode: "visual",
    source: JSON.stringify({
      type: "skymail.visual",
      version: 1,
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ayrıntılar " },
            { type: "text", text: "burada", marks: [{ type: "link", href: "https://skyl.app/e" }] },
            { type: "text", text: "dan öğren." },
          ],
        },
      ],
    }),
  },
];

describe("a render's warnings", () => {
  for (const input of glued) {
    it(`say what to do about a link glued to the next word in the plain text: ${input.mode}`, async () => {
      const result = await renderSource(input);

      assert.ok(result.ok, result.ok ? "" : result.message);
      assert.deepEqual(result.warnings, [GLUED]);
    });
  }

  it("are none for a body whose plain text reads well", async () => {
    const result = await renderSource({ mode: "html", source: '<p>Ayrıntılar <a href="https://skyl.app/e">burada</a>, gel.</p>' });

    assert.ok(result.ok);
    assert.deepEqual(result.warnings, []);
  });

  it("are the same for a stored body as for its render, so a publish can say them again", async () => {
    const result = await renderSource(glued[0]);

    assert.ok(result.ok);
    assert.deepEqual(renderWarnings(result.html, result.plainText), result.warnings);
  });
});
