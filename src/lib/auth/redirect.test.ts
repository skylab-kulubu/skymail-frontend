import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeCallbackPath } from "./redirect";

describe("the address after sign-in", () => {
  it("is the page the operator asked for, query included", () => {
    assert.equal(safeCallbackPath("/mail-tasks/create?mail_list_id=42"), "/mail-tasks/create?mail_list_id=42");
  });

  it("is the home screen for anything that would leave the site", () => {
    for (const raw of ["https://evil.example", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "", null]) {
      assert.equal(safeCallbackPath(raw), "/", `for ${String(raw)}`);
    }
  });
});
