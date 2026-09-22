/**
 * The daily series' dates are Istanbul calendar days (`YYYY-MM-DD`) and must
 * be labelled as they came. Read through a time zone, "2026-01-01" is UTC
 * midnight, which west of UTC is still 31 December — so this file runs the
 * labels in Los Angeles. The zone is set before sends.ts is loaded, because a
 * formatter takes the process's zone when it is built.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.TZ = "America/Los_Angeles";
const { dailySeries, dayLabel, dayTitle, formatSendTime } = await import("./sends");

describe("west of UTC", () => {
  it("really is: the process runs behind UTC", () => {
    assert.ok(new Date("2026-01-01T00:00:00Z").getTimezoneOffset() > 0);
    assert.equal(new Date("2026-01-01").getDate(), 31);
  });

  it("labels a date without moving it to the previous day", () => {
    assert.equal(dayLabel("2026-01-01"), "1 Oca");
    assert.equal(dayLabel("2026-12-31"), "31 Ara");
    assert.equal(dayTitle("2026-09-23"), "23 Eylül 2026 Çarşamba");
    assert.deepEqual(
      dailySeries([{ date: "2026-09-23", sent: 12 }]).map((point) => point.label),
      ["23 Eyl"],
    );
  });

  it("still shows a send's time in Istanbul", () => {
    assert.equal(formatSendTime("2026-09-22T21:10:00Z"), "23 Eyl 2026 00:10");
  });
});
