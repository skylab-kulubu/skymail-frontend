/**
 * core.feedback-request and core.feedback-reminder (ADR-0069): one mail a day
 * per person, listing that day's forms. Items is a list of { Title, URL }, so
 * the body ranges over it; inside the range .Title and .URL are the element's,
 * and only Items counts as the mail's variable.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { findActions } from "./go-template";
import { referencedVariables, renderComponent } from ".";

const KEYS = ["core.feedback-request", "core.feedback-reminder"];

async function rendered(key: string) {
  const template = findTemplate(key);
  assert.ok(template, key);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${key} does not render`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const actionsOf = (body: string) => findActions(body).map(({ start, end }) => body.slice(start, end).replace(/\s+/g, ""));

describe("the feedback mails", () => {
  for (const key of KEYS) {
    it(`${key} is a sensitive System template whose contract is Items`, async () => {
      const { meta, html } = await rendered(key);
      assert.equal(meta.system, true);
      assert.equal(meta.contentSensitive, true);
      assert.deepEqual(meta.variables, ["FirstName", "EventName", "Items"]);
      assert.deepEqual((meta.requiredVariables ?? []).map(({ name }) => name), ["Items"]);
      assert.deepEqual([...referencedVariables(html)].sort(), ["EventName", "FirstName", "Items"]);
    });

    it(`${key} prints a link per item, in both bodies`, async () => {
      const { html, plainText } = await rendered(key);
      for (const body of [html, plainText]) {
        const actions = actionsOf(body);
        const open = actions.indexOf("{{range.Items}}");
        assert.ok(open >= 0, "no range over Items");
        const close = actions.indexOf("{{end}}", open);
        const inside = actions.slice(open + 1, close);
        assert.ok(inside.includes("{{.Title}}") && inside.includes("{{.URL}}"), `range body: ${inside.join(" ")}`);
        // Title and URL belong to the element: none is read outside the range.
        const outside = [...actions.slice(0, open), ...actions.slice(close + 1)];
        assert.ok(!outside.includes("{{.Title}}") && !outside.includes("{{.URL}}"));
      }
      assert.match(html, /\{\{range \.Items\}\}[\s\S]*href="\{\{\.URL\}\}"[\s\S]*\{\{end\}\}/);
    });

    it(`${key} keeps the subject to EventName and its sample in the shape core sends`, async () => {
      const { meta } = await rendered(key);
      assert.ok(meta.subject.includes("{{.EventName}}"));
      assert.ok(!/\{\{\.(FirstName|Items)/.test(meta.subject));
      const items = meta.sample.Items;
      assert.ok(Array.isArray(items) && items.length > 0);
      for (const item of items as Record<string, unknown>[]) {
        assert.deepEqual(Object.keys(item).sort(), ["Title", "URL"]);
        assert.match(String(item.URL), /^https:\/\/forms\.yildizskylab\.com\/[0-9a-f-]{36}\?davet=[A-Za-z0-9_-]{22}$/);
      }
    });
  }

  it("the reminder says it is for who has not answered yet", async () => {
    const { plainText } = await rendered("core.feedback-reminder");
    assert.ok(plainText.includes("henüz doldurmadıysan"));
  });
});
