/**
 * The one way a screen turns whatever a failed action threw into the words the
 * operator reads.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError, apiErrorMessage, asApiError } from "./errors";

describe("what a failed action says", () => {
  it("is the API error's Turkish sentence", () => {
    assert.equal(
      apiErrorMessage(new ApiError(403, "server.forbidden", "You do not have permission")),
      "Bu işlem için yetkin yok.",
    );
  });

  // A TypeError from fetch or a bug in the page is not something the operator
  // can act on; it reads like a request that never reached the server.
  it("is the unreachable-server sentence for anything else", () => {
    assert.equal(apiErrorMessage(new TypeError("Failed to fetch")), "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.");
    assert.equal(apiErrorMessage("boom"), "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.");
  });

  it("keeps an API error as it is, so a screen can still read its status", () => {
    const error = new ApiError(404, "server.not_found");
    assert.equal(asApiError(error), error);
    assert.equal(asApiError(new Error("x")).status, 0);
  });
});
