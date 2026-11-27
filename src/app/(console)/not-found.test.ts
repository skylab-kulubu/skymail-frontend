/** A missing page inside the console: the 404 scene as a block in the shell, its title the page's one h1. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import NotFound from "./not-found";

const html = renderToStaticMarkup(NotFound());

describe("the console's not-found page", () => {
  it("draws the 404 scene without a main landmark of its own", () => {
    assert.match(html, /data-kind="notFound"/);
    assert.doesNotMatch(html, /<main/);
    assert.equal(html.match(/<h1/g)?.length, 1);
  });

  it("leads home", () => {
    assert.match(html, /<a href="\/"[^>]*>(?:(?!<\/a>).)*Ana sayfaya dön(?:(?!<\/a>).)*<\/a>/);
  });
});
