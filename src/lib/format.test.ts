/**
 * The club works in Istanbul: every time the template and send screens show
 * is Istanbul's, whatever zone the browser is in, so one version or one send
 * reads the same on every screen and for every operator.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLUB_TIME_ZONE, formatClubTime } from "./format";

describe("a time the club reads", () => {
  // 21:10 UTC is ten past midnight the next day in Istanbul (UTC+3).
  it("is Istanbul's", () => {
    assert.equal(CLUB_TIME_ZONE, "Europe/Istanbul");
    assert.equal(formatClubTime("2026-09-22T21:10:00Z"), "23 Eyl 2026 00:10");
  });

  it("is another zone's only when one is asked for, and the club's for a zone the browser does not know", () => {
    assert.equal(formatClubTime("2026-09-22T21:10:00Z", "UTC"), "22 Eyl 2026 21:10");
    assert.equal(formatClubTime("2026-09-22T21:10:00Z", "Mars/Olympus"), "23 Eyl 2026 00:10");
  });

  it("is a dash when there is no valid time", () => {
    assert.equal(formatClubTime(null), "—");
    assert.equal(formatClubTime(""), "—");
    assert.equal(formatClubTime("yok"), "—");
  });
});
