/**
 * Inserting a variable in the Visual editor offers the ones the template
 * already knows: its Required variables, and those it references somewhere.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderSource } from "../mail-render";
import type { MailTemplate } from "../templates";
import { offeredVariables } from "./visual-variables";

const template = (overrides: Partial<MailTemplate> = {}): MailTemplate => ({
  id: "7e3a1c00-0000-4000-8000-000000000001",
  name: "Duyuru",
  key: null,
  subject: "Duyuru",
  system: false,
  html_content: "<p>Merhaba</p>",
  plain_text_content: "Merhaba",
  react_email_content: "",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  archived_at: null,
  archived_by: null,
  published_version_id: null,
  ...overrides,
});

describe("the variables the Visual editor offers", () => {
  it("are the Required ones and every one the template references, each once, sorted", async () => {
    const html = await renderSource({ mode: "html", source: "<p>{{.EventName}} {{if .Venue}}{{.Venue}}{{end}}</p>" });
    const failed = await renderSource({ mode: "jsx", source: "export default () => <Text>{{.Broken}}" });

    const offered = offeredVariables(
      template({
        contract_required_variables: [{ name: "link", reason: "Sıfırlama bağlantısı" }],
        operator_required_variables: ["TicketUrl"],
      }),
      {
        storedHtml: '<a href="{{.link}}">{{.FirstName}}</a>',
        renders: { html, jsx: failed },
        subject: "{{.EventName}} için {{.FullName}}",
      },
    );

    assert.deepEqual(offered, ["EventName", "FirstName", "FullName", "TicketUrl", "Venue", "link"]);
  });

  it("are none for a template that has no variables anywhere", () => {
    assert.deepEqual(offeredVariables(template(), { storedHtml: "<p>Merhaba</p>", renders: {}, subject: "Duyuru" }), []);
  });
});
