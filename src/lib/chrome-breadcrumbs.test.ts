/**
 * The breadcrumb names every segment of the address, but only a segment that
 * is a page of its own may be a link. The address contract gives each section
 * a list, `create`, `edit/:id` and `show/:id` pages; `show` and `edit` alone,
 * or an id alone, are not pages.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backCrumb, chromeCrumbs } from "./chrome-breadcrumbs";

const ID = "1a2b3c4d-0000-4000-8000-000000000001";
const crumbs = (path: string) => chromeCrumbs(path).map((c) => [c.label, c.href, c.isPage]);

describe("the breadcrumb", () => {
  it("is the home screen alone at the root", () => {
    assert.deepEqual(crumbs("/"), [["Ana sayfa", "/", true]]);
  });

  it("links a section and its create page", () => {
    assert.deepEqual(crumbs("/mailing-lists/create"), [
      ["Mail listeleri", "/mailing-lists", true],
      ["Yeni", "/mailing-lists/create", true],
    ]);
  });

  it("does not link the show or edit segment of a record's address", () => {
    assert.deepEqual(crumbs(`/mailing-lists/show/${ID}`), [
      ["Mail listeleri", "/mailing-lists", true],
      ["Detay", "/mailing-lists/show", false],
      ["Kayıt", `/mailing-lists/show/${ID}`, true],
    ]);
    assert.deepEqual(crumbs(`/mail-tasks/show/${ID}`)[1], ["Detay", "/mail-tasks/show", false]);
    assert.deepEqual(crumbs(`/templates/edit/${ID}`)[1], ["Düzenle", "/templates/edit", false]);
  });

  it("names a Mail template's version history, and links only the page itself", () => {
    assert.deepEqual(crumbs(`/templates/history/${ID}`), [
      ["Mail template'ler", "/templates", true],
      ["Sürüm geçmişi", "/templates/history", false],
      ["Kayıt", `/templates/history/${ID}`, true],
    ]);
  });

  // Only a Mail template has a version history.
  it("has no history page under another section", () => {
    assert.deepEqual(crumbs(`/mailing-lists/history/${ID}`)[2], ["Kayıt", `/mailing-lists/history/${ID}`, false]);
    assert.deepEqual(crumbs(`/mail-tasks/history/${ID}`)[2], ["Kayıt", `/mail-tasks/history/${ID}`, false]);
  });

  it("does not link a segment outside the address contract", () => {
    assert.deepEqual(crumbs("/nope/missing"), [
      ["Nope", "/nope", false],
      ["Missing", "/nope/missing", false],
    ]);
    assert.deepEqual(crumbs(`/mailing-lists/${ID}`)[1], ["Kayıt", `/mailing-lists/${ID}`, false]);
  });
});

describe("the way back on a phone", () => {
  it("is the nearest page above the current one", () => {
    assert.equal(backCrumb(chromeCrumbs(`/mailing-lists/show/${ID}`))?.href, "/mailing-lists");
    assert.equal(backCrumb(chromeCrumbs("/mailing-lists/create"))?.href, "/mailing-lists");
  });

  it("is none on a section's own page", () => {
    assert.equal(backCrumb(chromeCrumbs("/mailing-lists")), null);
    assert.equal(backCrumb(chromeCrumbs("/nope/missing")), null);
  });
});
