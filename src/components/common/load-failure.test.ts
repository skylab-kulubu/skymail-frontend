/**
 * A page whose data would not load shows the unavailable scene when SkyNotify did not answer
 * ("SkyNotify şu anda yanıt vermiyor"), the time-limit drawing for a 504, and the warning icon
 * for anything else.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlertTriangle } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "@/lib/api/errors";
import { loadFailureArt } from "./load-failure";

const drawn = (error: unknown) => {
  const { top } = loadFailureArt(error);
  return top ? renderToStaticMarkup(top) : null;
};

describe("a load failure's picture", () => {
  it("draws the unavailable scene's server-gone-for-tea drawing for a 502 or a 503", () => {
    for (const status of [502, 503]) {
      const error = new ApiError(status, `http.${status}`);
      assert.match(error.message, /yanıt vermiyor/);
      assert.match(drawn(error) ?? "", /data-kind="unavailable" data-variant="A"/);
      assert.equal(loadFailureArt(error).icon, undefined);
    }
  });

  it("draws the time limit for a 504", () => {
    assert.match(drawn(new ApiError(504, "http.504")) ?? "", /data-kind="unavailable" data-variant="B"/);
  });

  it("keeps the warning icon for every other failure", () => {
    for (const error of [new ApiError(500, "http.500"), new ApiError(0, "network"), new ApiError(404, "http.404"), new Error("x")]) {
      assert.equal(drawn(error), null);
      assert.equal(loadFailureArt(error).icon, AlertTriangle);
    }
  });
});
