/**
 * A tab opened before a deploy still holds the old build's Server Action IDs
 * (each build salts them afresh). Its "Giriş yap", "Yeniden giriş yap" and
 * "Çıkış" buttons then reach a server that does not know them, and Next.js
 * throws on the client instead of reloading. The root error boundary hands the
 * error here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { recoverFromVersionSkew } from "./version-skew";

describe("an error that reaches the root error boundary", () => {
  it("reloads the page when a Server Action came from another build", () => {
    let reloads = 0;
    const recovered = recoverFromVersionSkew(
      new UnrecognizedActionError('Server Action "abc" was not found on the server.'),
      () => (reloads += 1),
    );

    assert.equal(recovered, true);
    assert.equal(reloads, 1);
  });

  it("leaves any other error to the error screen", () => {
    let reloads = 0;
    const recovered = recoverFromVersionSkew(new Error("boom"), () => (reloads += 1));

    assert.equal(recovered, false);
    assert.equal(reloads, 0);
  });
});
