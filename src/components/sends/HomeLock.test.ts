/**
 * The home screen's lock, for one who can neither read the sends nor compose
 * one, as the server renders it: plain words, no role names, and for an
 * approver a way to the mail approvals.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SkylcnProvider } from "@skylab-kulubu/skylcn-ui";
import { HomeLock } from "./HomeLock";

const render = (approver: boolean) =>
  renderToStaticMarkup(createElement(SkylcnProvider, { locale: "tr", children: createElement(HomeLock, { approver }) }));

/** The visible words, tags removed. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the home screen's lock", () => {
  it("says there is no send permission in plain words, without a role name", () => {
    const html = render(false);
    assert.match(text(html), /Gönderim yetkin yok/);
    assert.match(text(html), /kulüp yönetimine başvur/);
    assert.doesNotMatch(html, /skymail:/);
    assert.doesNotMatch(html, /href="\/mail-approvals"/);
  });

  it("leads an approver to the mail approvals", () => {
    const html = render(true);
    assert.match(html, /href="\/mail-approvals"/);
    assert.match(text(html), /Mail onaylarına git/);
    assert.doesNotMatch(html, /skymail:/);
  });
});
