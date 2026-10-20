/**
 * The formatter puts an element's content on a line of its own, indented. An
 * element that keeps its whitespace (white-space: pre-wrap and the like) shows
 * that: a note opens with an empty line and forty spaces. The render module
 * keeps such content against its tags, exactly as React wrote it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { render } from "@react-email/render";
import { templates } from "../../../emails";
import { renderComponent } from ".";
import { renderElement } from "./render";

// A style as long as the theme's, so the formatter breaks the element across lines.
const fontFamily = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const keep = (whiteSpace: string, ...children: ReactNode[]) =>
  createElement("div", null, createElement("p", { style: { margin: 0, fontFamily, whiteSpace } }, ...children), createElement("p", null, "Sonra"));

describe("an element that keeps its whitespace", () => {
  it("keeps its content against its tags, line breaks and spaces as written", async () => {
    const { html } = await renderElement(keep("pre-wrap", "{{.reviewNote}}\n  ikinci satır"), 2000);
    assert.ok(html.includes('white-space:pre-wrap">{{.reviewNote}}\n  ikinci satır</p>'), html);
  });

  it("keeps an element inside it as written too", async () => {
    const { html } = await renderElement(keep("pre-line", "Önce ", createElement("strong", null, "kalın"), " sonra"), 2000);
    assert.ok(html.includes('white-space:pre-line">Önce <strong>kalın</strong> sonra</p>'), html);
  });

  it("keeps it against its tags when the actions are kept whole as well", async () => {
    const action = "{{if and .reviewNote (ne .status `reopened`) (ne .status `declined`)}}not{{end}}";
    const { html } = await renderElement(keep("pre-wrap", action), 2000, { keepActionsWhole: true });
    assert.ok(html.includes(`white-space:pre-wrap">${action}</p>`), html);
  });

  it("leaves an element that does not keep whitespace to the formatter", async () => {
    const element = keep("nowrap", "{{.reviewNote}}");
    const { html } = await renderElement(element, 2000);
    assert.match(html, /white-space:nowrap">\s+\{\{\.reviewNote\}\}\s+<\/p>/);
    assert.equal(html, await render(element, { pretty: true }));
  });

  it("is against its tags in every template", async () => {
    for (const { meta, Component } of templates) {
      const rendered = await renderComponent(Component);
      assert.ok(rendered.ok, meta.key);
      for (const [, content] of rendered.html.matchAll(/white-space:\s*(?:pre|pre-wrap|pre-line|break-spaces)\b[^"]*"[^>]*>([^<]*)</g)) {
        assert.equal(content, content.trim(), `${meta.key}: "${content}" has whitespace around it`);
      }
    }
  });
});
