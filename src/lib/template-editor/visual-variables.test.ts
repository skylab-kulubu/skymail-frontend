/**
 * Inserting a variable in the Visual editor offers the ones the template
 * already knows: its Required variables, and those it references somewhere.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderSource } from "../mail-render";
import { offeredVariables } from "./visual-variables";

describe("the variables the Visual editor offers", () => {
  it("are the Required ones and every one the template references, each once, sorted", async () => {
    const html = await renderSource({ mode: "html", source: "<p>{{.EventName}} {{if .Venue}}{{.Venue}}{{end}}</p>" });
    const failed = await renderSource({ mode: "jsx", source: "export default () => <Text>{{.Broken}}" });

    const offered = offeredVariables(
      { contract_required_variables: [{ name: "link", reason: "Sıfırlama bağlantısı" }], operator_required_variables: ["TicketUrl"] },
      {
        storedHtml: '<a href="{{.link}}">{{.FirstName}}</a>',
        renders: { html, jsx: failed },
        subject: "{{.EventName}} için {{.FullName}}",
      },
    );

    assert.deepEqual(offered, ["EventName", "FirstName", "FullName", "TicketUrl", "Venue", "link"]);
  });

  it("are none for a template that has no variables anywhere", () => {
    assert.deepEqual(offeredVariables({}, { storedHtml: "<p>Merhaba</p>", renders: {}, subject: "Duyuru" }), []);
  });
});
