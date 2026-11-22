/**
 * The "Kim açtı" table of a send (hub ticket skymail-frontend-rewrite 32) as
 * the server renders it: newest first as the API gave it, the recipient's
 * name where the row was found, an erased opener. The data is made up.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SkylcnProvider } from "@skylab-kulubu/skylcn-ui";
import type { ContentView } from "@/lib/content-views";
import { ERASED_PERSON, ERASED_SUBJECT } from "@/lib/people";
import { ContentViewsTable } from "./ContentViews";

const render = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(SkylcnProvider, { locale: "tr", children: element }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const view = (id: string, name: string | null, sub: string, row: string, at: string): ContentView => ({
  id,
  queue_item_id: row,
  actor: { sub, name },
  masked_by: "variables",
  masked_variables: ["code"],
  created_at: at,
});

describe("Kim açtı", () => {
  const items = [
    view("v2", "Mert Kaya", "s2", "row-1", "2026-11-22T10:05:00Z"),
    view("v1", ERASED_PERSON, ERASED_SUBJECT, "row-2", "2026-11-22T09:00:00Z"),
  ];

  it("lists the openers in the API's order with the recipient whose mail was opened", () => {
    const words = text(
      render(
        createElement(ContentViewsTable, {
          views: { items, total: 2 },
          recipients: new Map([["row-1", "Ayşe Demir"]]),
          page: 1,
          onPageChange: () => {},
        }),
      ),
    );
    assert.match(words, /Kim Ne zaman Alıcı/);
    assert.ok(words.indexOf("Mert Kaya") < words.indexOf(ERASED_PERSON), words);
    assert.match(words, /Mert Kaya .*Ayşe Demir/);
    // The second row was not found among the send's rows: no name.
    assert.match(words, new RegExp(`${ERASED_PERSON} .* —`));
  });

  it("shows no recipient while the rows are not read", () => {
    const words = text(render(createElement(ContentViewsTable, { views: { items, total: 2 }, recipients: null, page: 1, onPageChange: () => {} })));
    assert.doesNotMatch(words, /Ayşe/);
  });

  it("says when no one opened it", () => {
    const words = text(render(createElement(ContentViewsTable, { views: { items: [], total: 0 }, recipients: null, page: 1, onPageChange: () => {} })));
    assert.match(words, /Maskeli içeriği açan olmadı\./);
  });
});
