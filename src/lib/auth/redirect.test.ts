import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeCallbackPath } from "./redirect";

describe("the address after sign-in", () => {
  it("is the page the operator asked for, query and fragment included", () => {
    assert.equal(safeCallbackPath("/mail-tasks/create?mail_list_id=42"), "/mail-tasks/create?mail_list_id=42");
    assert.equal(safeCallbackPath("/ok?x=1#h"), "/ok?x=1#h");
  });

  it("is the home screen for anything that would leave the site", () => {
    for (const raw of [
      "https://evil.example",
      "//evil.example/x",
      "/\\evil.example",
      "\\/evil.example",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      assert.equal(safeCallbackPath(raw), "/", `for ${JSON.stringify(raw)}`);
    }
  });

  // `/login?callbackUrl=/%09/evil.example` reaches the page decoded, as
  // "/\t/evil.example". It does not start with "//", but a browser strips the
  // tab from a Location header and lands on //evil.example.
  it("is the home screen when control characters hide a second slash", () => {
    for (const raw of ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\u0000/evil.example"]) {
      assert.equal(safeCallbackPath(raw), "/", `for ${JSON.stringify(raw)}`);
    }
  });

  it("keeps an encoded control character encoded, on this site", () => {
    assert.equal(safeCallbackPath("/%09/evil.example"), "/%09/evil.example");
  });
});
