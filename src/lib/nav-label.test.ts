/**
 * Mail onayları says how many requests wait: beside the label while the
 * sidebar is wide (the badge), in the label itself on the icon rail, where
 * skylcn shows only a dot and names the link by its label.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { navLabel } from "./access";

describe("a section's name in the menu", () => {
  it("carries the waiting count on the icon rail", () => {
    assert.equal(navLabel("Mail onayları", 3, true), "Mail onayları (3 bekleyen)");
  });

  it("is the label alone while the sidebar is wide (the badge says the count)", () => {
    assert.equal(navLabel("Mail onayları", 3, false), "Mail onayları");
  });

  it("is the label alone when nothing waits", () => {
    assert.equal(navLabel("Mail onayları", 0, true), "Mail onayları");
  });
});
