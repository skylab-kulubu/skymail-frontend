/**
 * HTML mode is the escape hatch: raw markup, stored as written. Its plain-text
 * part is derived, and the derivation must not touch a Go template action,
 * because the mailer parses the plain text as a template too — an action that
 * comes out upper-cased or re-spaced is a mail that fails to send.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderSource, type SourceInput } from ".";

async function renderHtml(source: string) {
  const result = await renderSource({ mode: "html", source });
  assert.equal(result.ok, true, result.ok ? "" : result.message);
  assert.ok(result.ok);
  return result;
}

describe("HTML mode", () => {
  it("stores the markup exactly as written and derives the plain text from it", async () => {
    const source = '<div>\n  <p>Merhaba,</p>\n  <p>Etkinlik <a href="https://skyl.app/e/1">burada</a>.</p>\n</div>\n';

    const result = await renderHtml(source);

    assert.equal(result.html, source);
    assert.equal(result.plainText, "Merhaba,\n\nEtkinlik burada https://skyl.app/e/1.");
  });

  const actions: { name: string; source: string; action: string }[] = [
    {
      // html-to-text upper-cases headings: {{.Name}} would become {{.NAME}}.
      name: "in a heading",
      source: "<h1>Merhaba {{.FirstName}}</h1>",
      action: "{{.FirstName}}",
    },
    {
      name: "with spacing of its own",
      source: "<p>{{ if  .Link }}bağlantı{{ end }}</p>",
      action: "{{ if  .Link }}",
    },
    {
      name: "a comment across lines",
      source: "<p>{{/* bu yorum\n   iki satır */}}Merhaba</p>",
      action: "{{/* bu yorum\n   iki satır */}}",
    },
    {
      name: "with trim markers",
      source: "<p>Merhaba {{- .FirstName -}} !</p>",
      action: "{{- .FirstName -}}",
    },
    {
      name: "holding a string that looks like markup",
      source: '<p>{{if eq .Kind "<b>önemli</b>"}}Önemli{{end}}</p>',
      action: '{{if eq .Kind "<b>önemli</b>"}}',
    },
    {
      name: "holding an entity",
      source: "<p>{{if eq .Team `R&amp;D`}}Ar-Ge{{end}}</p>",
      action: "{{if eq .Team `R&amp;D`}}",
    },
    {
      name: "as a link's address",
      source: '<p><a href="{{.ResetLink}}">Şifreni sıfırla</a></p>',
      action: "{{.ResetLink}}",
    },
    {
      name: "around table rows",
      source: "<table><tbody>{{range .Items}}<tr><td>{{.Title}}</td></tr>{{end}}</tbody></table>",
      action: "{{range .Items}}",
    },
  ];

  for (const { name, source, action } of actions) {
    it(`keeps an action ${name} byte for byte, in both bodies`, async () => {
      const result = await renderHtml(source);

      assert.equal(result.html, source);
      assert.ok(
        result.plainText.includes(action),
        `düz metinde ${JSON.stringify(action)} yok: ${JSON.stringify(result.plainText)}`,
      );
    });
  }

  it("keeps an if with its else and end, in order", async () => {
    const result = await renderHtml("<p>{{if .Name}}Merhaba {{.Name}}{{else}}Merhaba{{end}}</p>");

    assert.equal(result.plainText, "{{if .Name}}Merhaba {{.Name}}{{else}}Merhaba{{end}}");
  });

  it("writes a link whose text is its own address once, as JSX mode does", async () => {
    const result = await renderHtml('<p><a href="{{.VerifyURL}}">{{.VerifyURL}}</a></p>');

    assert.equal(result.plainText, "{{.VerifyURL}}");
  });

  for (const [name, source] of [
    ["nothing", ""],
    ["only whitespace", "  \n\t "],
    ["only a comment", "<!-- sonra yazılacak -->\n"],
  ]) {
    it(`does not accept ${name} as a body`, async () => {
      const result = await renderSource({ mode: "html", source });

      assert.equal(result.ok, false);
      assert.ok(!result.ok);
      assert.equal(result.reason, "empty");
    });
  }
});

describe("a mode the module does not render", () => {
  // Visual arrives with ticket 15. Until its case is written, a Visual source
  // must not be compiled as JSX and reported as broken code.
  it("is refused as a caller's mistake, not taken for JSX", async () => {
    const input = { mode: "visual", source: '{"type":"doc","content":[]}' } as unknown as SourceInput;

    await assert.rejects(renderSource(input), /visual/);
  });
});
