import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSandbox } from "./environment";

describe("isSandbox", () => {
  it("reads the sandbox from the SkyMail API address", () => {
    assert.equal(isSandbox("https://sandbox-api.yildizskylab.com/api/skymail/v1"), true);
    assert.equal(isSandbox("http://localhost:3000/sandbox-api/api/skymail/v1"), true);
  });

  it("never marks production or an address it cannot read", () => {
    assert.equal(isSandbox("https://api.yildizskylab.com/api/skymail/v1"), false);
    assert.equal(isSandbox("http://localhost:3013/e2e-api/v1"), false);
    assert.equal(isSandbox(""), false);
    assert.equal(isSandbox("not a url"), false);
  });
});
