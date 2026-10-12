/**
 * The screens outside the shell (sign-in, "erişimin yok") carry the
 * developer credit, as the Refine panel's sign-in screen did.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthScreen } from "./AuthScreen";

const html = renderToStaticMarkup(createElement(AuthScreen, { title: "Giriş", children: "SkyMail hesabınla giriş yap" }));

describe("the sign-in frame", () => {
  it("credits the developer", () => {
    assert.match(html, /Developed by Enes Genç/);
  });

  it("links the credit to his site in a new tab without handing over the opener", () => {
    const link = html.match(/<a [^>]*>Developed by Enes Genç<\/a>/)?.[0] ?? "";
    assert.match(link, /href="https:\/\/enesgenc\.dev"/);
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
  });
});
