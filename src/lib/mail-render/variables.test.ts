/**
 * The variables a body references are what the preview asks sample values for
 * and what the Required variable panel will check against. A reference is a
 * field of the data the mailer passes in, used inside a Go action: not a word
 * in the text, not a comment, not a string.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockBalance, referencedVariables, renderSource } from ".";

async function variablesOf(mode: "jsx" | "html", source: string): Promise<string[]> {
  const result = await renderSource({ mode, source });
  assert.equal(result.ok, true, result.ok ? "" : result.message);
  assert.ok(result.ok);
  return result.variables;
}

describe("the variables a body references", () => {
  const cases: { name: string; source: string; expect: string[] }[] = [
    { name: "a plain field", source: "<p>Merhaba {{.FirstName}}</p>", expect: ["FirstName"] },
    {
      name: "a field inside an if, and the if's own",
      source: '{{if .ResetLink}}<a href="{{.ResetLink}}">Sıfırla</a>{{end}}',
      expect: ["ResetLink"],
    },
    {
      name: "a comparison and an else if",
      source: "{{if eq .Decision `approved`}}Onay{{else if .Reason}}{{.Reason}}{{end}}",
      expect: ["Decision", "Reason"],
    },
    {
      name: "function arguments and pipes",
      source: '{{safeHTML .BodyHtml}} {{printf "%s %s" .First .Last}} {{.Team | html}}',
      expect: ["BodyHtml", "First", "Last", "Team"],
    },
    {
      name: "the first field of a chain",
      source: "{{.Event.Title}}",
      expect: ["Event"],
    },
    {
      name: "a field kept in a variable, not the variable's own fields",
      source: "{{$event := .Event}}{{$event.Title}}",
      expect: ["Event"],
    },
    {
      // Inside range, dot is the element: .Title is a field of an item, and
      // $ is how the body reaches back to the data the mailer passed.
      name: "a range's list, and $ inside it, but not the element's fields",
      source: "<ul>{{range .Items}}<li>{{.Title}} · {{$.EventName}}</li>{{end}}</ul>",
      expect: ["EventName", "Items"],
    },
    {
      // A with's else runs with the outer dot again.
      name: "a with's value and its else branch",
      source: "{{with .Organizer}}{{.Name}}{{else}}{{.FallbackName}}{{end}}",
      expect: ["FallbackName", "Organizer"],
    },
    {
      name: "nothing inside a define, whose data its caller decides",
      source: '{{define "footer"}}{{.Team}} {{$.Year}}{{end}}{{.Name}}',
      expect: ["Name"],
    },
    {
      name: "a block given dot, read like the text around it",
      source: '{{block "footer" .}}{{.Team}}{{end}}{{block "other" .Org}}{{.Inner}}{{end}}',
      expect: ["Org", "Team"],
    },
    {
      name: "each name once, sorted",
      source: "{{.Name}} {{.Email}} {{if .Name}}{{.Name}}{{end}}",
      expect: ["Email", "Name"],
    },
    {
      name: "nothing from a comment",
      source: "<p>{{/* .Secret buraya gelecek */}}Merhaba{{- /* .Other */ -}}</p>",
      expect: [],
    },
    {
      name: "nothing from the text around the actions",
      source: "<p>Dosya adı .Name, tek parantez {.Link}, {{.Real}}</p>",
      expect: ["Real"],
    },
    {
      name: "nothing from a string or a number",
      source: '{{if eq .Kind ".Other"}}x{{end}}{{if gt .Count .5}}y{{end}}',
      expect: ["Count", "Kind"],
    },
  ];

  for (const { name, source, expect } of cases) {
    it(`finds ${name}`, async () => {
      assert.deepEqual(await variablesOf("html", source), expect);
    });
  }

  it("finds the fields the emails/go.ts helpers write in a JSX source", async () => {
    const source = `
      import { Text } from "@react-email/components";
      import { cond, elseBranch, end, ifEq, ifSet, v } from "./go";

      export default function Email() {
        return (
          <Text>
            {ifSet("FirstName")}Merhaba {v("FirstName")}{end}
            {ifEq("Decision", "approved")}Onaylandı{elseBranch}Reddedildi{end}
            <a href={cond("TicketUrl", v("TicketUrl"), "https://skyl.app")}>Bilet</a>
          </Text>
        );
      }
    `;

    assert.deepEqual(await variablesOf("jsx", source), ["Decision", "FirstName", "TicketUrl"]);
  });
});

describe("reading actions outside a render", () => {
  // emails:render checks a subject's variables and a body's blocks with the
  // same scanner, rather than with regexes of its own.
  it("finds the variables of a subject", () => {
    assert.deepEqual(referencedVariables("{{ .EventName }} için {{if .Venue}}{{.Venue}}{{end}}"), ["EventName", "Venue"]);
  });

  it("counts the blocks a body opens and the ends that close them, past comments and strings", () => {
    assert.deepEqual(blockBalance('{{if .A}}{{- range .B}}{{end}}'), { opens: 2, ends: 1 });
    assert.deepEqual(blockBalance('{{/* {{if .X}} */}}{{if eq .K "{{end}}"}}x{{ end }}'), { opens: 1, ends: 1 });
  });

  // The pretty printer wraps a long line inside an action — `{{if\n  .link}}`.
  // Go parses that fine, so neither the block count nor the variables may
  // depend on a plain space after the keyword (main #33 hit this with a regex).
  it("reads an action the pretty printer wrapped across lines", () => {
    const wrapped = '<a href="{{if\n        .link}}{{.link}}{{end\n}}">x</a>{{\n  range .Items}}{{.Name}}{{\tend}}';
    assert.deepEqual(blockBalance(wrapped), { opens: 2, ends: 2 });
    assert.deepEqual(referencedVariables(wrapped), ["Items", "link"]);
  });
});
