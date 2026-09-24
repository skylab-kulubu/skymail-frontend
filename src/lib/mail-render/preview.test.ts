/**
 * A preview is the stored body with sample values in place of its actions, so
 * a template is judged the way a recipient reads it. It is never saved, and it
 * is not the mailer: it reads the actions the club's templates use and leaves
 * the rest as written.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillSampleValues } from ".";

describe("a preview with sample values", () => {
  it("puts each sample value where its field is", () => {
    assert.equal(
      fillSampleValues('<p>Merhaba {{.FirstName}}, <a href="{{.Link}}">bağlantı</a></p>', {
        FirstName: "Yusuf",
        Link: "https://skyl.app/e/1",
      }),
      '<p>Merhaba Yusuf, <a href="https://skyl.app/e/1">bağlantı</a></p>',
    );
  });

  it("reads a field however the action is spaced or trimmed, and through $", () => {
    assert.equal(
      fillSampleValues("<p>{{ .A }}|{{$.B}}|x   {{- .C -}}   y</p>", { A: "1", B: "2", C: "3" }),
      "<p>1|2|x3y</p>",
    );
  });

  it("escapes a value, as the mailer's html/template does", () => {
    assert.equal(
      fillSampleValues("<p>{{.Team}}</p>", { Team: `<b>"R&D"</b> 'ekip'` }),
      "<p>&lt;b&gt;&quot;R&amp;D&quot;&lt;/b&gt; &#39;ekip&#39;</p>",
    );
  });

  it("names a field that has no sample value rather than leaving it blank", () => {
    assert.equal(fillSampleValues("<p>{{.EventName}}</p>", {}), "<p>«EventName»</p>");
  });

  it("inserts a safeHTML value as markup, and nothing when it has none", () => {
    assert.equal(
      fillSampleValues("<div>{{safeHTML .BodyHtml}}</div><div>{{safeHTML .Footer}}</div>", {
        BodyHtml: "<p><strong>Kalın</strong></p>",
      }),
      "<div><p><strong>Kalın</strong></p></div><div></div>",
    );
  });

  const conditions: { name: string; body: string; sample: Record<string, unknown>; expect: string }[] = [
    {
      name: "an if whose field has a value",
      body: '{{if .CtaUrl}}<a href="{{.CtaUrl}}">Git</a>{{end}}',
      sample: { CtaUrl: "https://skyl.app" },
      expect: '<a href="https://skyl.app">Git</a>',
    },
    {
      name: "an if whose field is empty or missing",
      body: "a{{if .CtaUrl}}<a>Git</a>{{end}}b{{if .Note}}n{{end}}",
      sample: { CtaUrl: "" },
      expect: "ab",
    },
    {
      name: "the else of an unset field",
      body: "{{if .FirstName}}Merhaba {{.FirstName}}{{else}}Merhaba{{end}},",
      sample: {},
      expect: "Merhaba,",
    },
    {
      name: "an eq comparison, with its else",
      body: "{{if eq .Decision `approved`}}Onaylandı{{else}}Reddedildi{{end}}",
      sample: { Decision: "rejected" },
      expect: "Reddedildi",
    },
    {
      name: "an else if chain",
      body: '{{if eq .Kind "a"}}A{{else if .Fallback}}F{{else}}-{{end}}',
      sample: { Kind: "b", Fallback: "var" },
      expect: "F",
    },
    {
      name: "a nested if in a branch that is not taken",
      body: "{{if .A}}{{if .B}}ab{{else}}a{{end}}{{else}}none{{end}}",
      sample: { B: "x" },
      expect: "none",
    },
    {
      // What a Visual section for "when the variable is not set" writes.
      name: "an if not whose field is set",
      body: "{{if not .Venue}}Yer yakında duyurulacak.{{else}}Yer: {{.Venue}}{{end}}",
      sample: { Venue: "Davutpaşa" },
      expect: "Yer: Davutpaşa",
    },
    {
      name: "an if not whose field is empty",
      body: "{{if not .Venue}}Yer yakında duyurulacak.{{end}}",
      sample: { Venue: "" },
      expect: "Yer yakında duyurulacak.",
    },
    {
      name: "a string holding the closing delimiter",
      body: '{{if eq .K "}}"}}kapanış{{end}}.',
      sample: { K: "}}" },
      expect: "kapanış.",
    },
  ];

  for (const { name, body, sample, expect } of conditions) {
    it(`shows the branch the sample values select: ${name}`, () => {
      assert.equal(fillSampleValues(body, sample), expect);
    });
  }

  // The Visual editor writes braces an operator typed as the action that prints them.
  it("prints what an action holding only a string prints", () => {
    assert.equal(fillSampleValues("<p>Şablonda {{`{{`}}.Ad}} yazılır, {{\"<b>\"}}</p>", {}), "<p>Şablonda {{.Ad}} yazılır, &lt;b&gt;</p>");
  });

  it("drops a comment, as the mailer does", () => {
    assert.equal(fillSampleValues("<p>{{/* not */}}Merhaba{{- /* iki */ -}} !</p>", {}), "<p>Merhaba!</p>");
  });

  it("leaves range and with, and what they contain, as written", () => {
    const body = "<ul>{{range .Items}}<li>{{.Title}}{{if .Done}}✓{{end}}</li>{{end}}</ul>{{with .Org}}{{.Name}}{{end}}";

    assert.equal(fillSampleValues(body, { Items: ["a"], Title: "x", Done: true, Org: "o", Name: "n" }), body);
  });

  // The pretty printer wraps long lines inside an action, even between `else`
  // and `if` (mail.approval-resolved, main #50). The branch chosen must not
  // depend on the whitespace.
  it("picks the branch of an else-if the pretty printer wrapped", () => {
    const body =
      "<h1>{{if eq .Decision `approved`}}ONAY{{else\n                    if eq .Decision `returned`}}GERI{{else}}RED{{end}}</h1>";

    assert.equal(fillSampleValues(body, { Decision: "approved" }), "<h1>ONAY</h1>");
    assert.equal(fillSampleValues(body, { Decision: "returned" }), "<h1>GERI</h1>");
    assert.equal(fillSampleValues(body, { Decision: "rejected" }), "<h1>RED</h1>");
  });

  it("fills a subject as text, without escaping", () => {
    assert.equal(
      fillSampleValues("{{.EventName}} başvuruları açıldı", { EventName: "R&D <Kış>" }, { as: "text" }),
      "R&D <Kış> başvuruları açıldı",
    );
  });
});
