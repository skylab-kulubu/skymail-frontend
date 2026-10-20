/**
 * A tracked send's opens and clicks (hub ticket iletisim-servisi 15b,
 * skymail-backend 14b): who may see the recipients one by one, what the
 * section calls each thing, and the hourly-then-daily series.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { json, scriptedClient } from "./api/testing";
import { ROLE } from "./access";
import {
  clickedLinksText,
  fetchTrackingRecipients,
  fetchTrackingSummary,
  linkLabel,
  mayReadTrackingRecipients,
  noLikelyOpenText,
  recipientBadges,
  sendTracked,
  seriesHasEvents,
  shareOf,
  skipReasonLabel,
  trackingSeries,
  untrackedParts,
  type TrackingPoint,
} from "./tracking-report";

const SEND_ID = "b1c2d3e4-0000-4000-8000-000000000001";
const SENDER = "8d0f5c2e-6b1a-4c3e-9f27-5a1d3b7e9c41";
const SOMEONE = "0c9e4f6a-1b2d-4c3e-8f7a-9d0e1f2a3b4c";
const READER = ["skymail:access", "skymail:mails:read"];

describe("the section", () => {
  it("shows only for a send that asked for tracking and got it", () => {
    assert.equal(sendTracked({ tracking: true }), true);
    assert.equal(sendTracked({ tracking: false }), false);
    assert.equal(sendTracked({}), false);
  });
});

describe("who sees the recipients one by one", () => {
  it("the tracking reader (YK, DK, ADMIN) sees every send's", () => {
    assert.equal(mayReadTrackingRecipients([...READER, ROLE.mailsTrackingRead], SOMEONE, { sent_by: SENDER }), true);
  });

  it("the send's own sender sees their own without the role", () => {
    assert.equal(mayReadTrackingRecipients(READER, SENDER, { sent_by: SENDER }), true);
  });

  it("anyone else gets the counts only", () => {
    assert.equal(mayReadTrackingRecipients(READER, SOMEONE, { sent_by: SENDER }), false);
    assert.equal(mayReadTrackingRecipients(READER, null, { sent_by: SENDER }), false);
    assert.equal(mayReadTrackingRecipients(READER, "", { sent_by: "" }), false);
  });

  it("the role counts only with skymail:access", () => {
    assert.equal(mayReadTrackingRecipients([ROLE.mailsTrackingRead], SOMEONE, { sent_by: SENDER }), false);
  });
});

describe("the read routes", () => {
  it("asks for the summary of the send", async () => {
    const { api, calls } = scriptedClient(json(200, { tracking_available: true, tracking_requested: true, retained: false, report: null }));
    await fetchTrackingSummary(api, SEND_ID);
    assert.equal(new URL(calls[0].url).pathname, `/api/skymail/v1/mail_tasks/${SEND_ID}/tracking`);
  });

  it("asks for a filtered page of recipients, and leaves the filter out for all", async () => {
    const page = { tracking_available: true, page: 2, page_size: 25, total: 30, items: [] };
    const { api, calls } = scriptedClient(json(200, page), json(200, page));
    await fetchTrackingRecipients(api, SEND_ID, { filter: "clicked", page: 2 });
    await fetchTrackingRecipients(api, SEND_ID, { filter: "all", page: 1 });
    const first = new URL(calls[0].url);
    assert.equal(first.pathname, `/api/skymail/v1/mail_tasks/${SEND_ID}/tracking/recipients`);
    assert.equal(first.searchParams.get("filter"), "clicked");
    assert.equal(first.searchParams.get("page"), "2");
    assert.equal(first.searchParams.get("page_size"), "25");
    assert.equal(new URL(calls[1].url).searchParams.has("filter"), false);
  });

  it("reports the year-old send's 410 as such", async () => {
    const { api } = scriptedClient(json(410, { code: "mail.tracking_expired", message: "Kişi bazında takip kaydı 1 yıl sonra silindi." }));
    await assert.rejects(fetchTrackingRecipients(api, SEND_ID, { filter: "all", page: 1 }), { status: 410 });
  });

  it("does not ask for a malformed send id", async () => {
    const { api, calls } = scriptedClient();
    await assert.rejects(fetchTrackingSummary(api, "nope"), { status: 404 });
    assert.equal(calls.length, 0);
  });
});

describe("the wording", () => {
  it("names each reason a recipient was not tracked in plain words", () => {
    assert.equal(skipReasonLabel("no_account"), "Hesabı yok");
    assert.equal(skipReasonLabel("not_member"), "Üye değil");
    assert.equal(skipReasonLabel("preference_off"), "Takibi kapatmış");
    assert.equal(skipReasonLabel("inactive"), "Hesabı etkin değil");
    assert.equal(skipReasonLabel("preference_unavailable"), "Tercihi öğrenilemedi");
    assert.equal(skipReasonLabel("flag_off"), "Takip kapalıydı");
    assert.equal(skipReasonLabel("something_new"), "Diğer");
    assert.equal(skipReasonLabel(null), "Diğer");
  });

  it("sums the untracked by reason, largest first", () => {
    assert.deepEqual(untrackedParts({ no_account: 2, preference_off: 5, not_member: 0, odd: 1, other: 1 }), {
      total: 9,
      parts: ["Takibi kapatmış: 5", "Diğer: 2", "Hesabı yok: 2"],
    });
    assert.deepEqual(untrackedParts({}), { total: 0, parts: [] });
  });

  it("gives a share only of someone tracked", () => {
    assert.equal(shareOf(2, 5), "%40");
    assert.equal(shareOf(0, 0), null);
  });

  it("names a link by its place in the mail, from one", () => {
    assert.equal(linkLabel(0), "1. bağlantı");
    assert.equal(
      clickedLinksText(
        [
          { link_id: 11, clicks: 1, last_clicked_at: "2026-10-20T10:00:00Z" },
          { link_id: 12, clicks: 3, last_clicked_at: "2026-10-20T11:00:00Z" },
          { link_id: 99, clicks: 1, last_clicked_at: "2026-10-20T11:00:00Z" },
        ],
        [
          { id: 11, position: 0, clicks: 1, unique_clickers: 1 },
          { id: 12, position: 2, clicks: 3, unique_clickers: 1 },
        ],
      ),
      "1. bağlantı, 3. bağlantı (3), bağlantı",
    );
    assert.equal(clickedLinksText([], []), "—");
  });

  it("marks Apple Mail, Gmail, a scanner and an open inferred from a click (design note 07 §3.2)", () => {
    const labels = recipientBadges({
      source_classes: ["browser", "scanner_likely", "google_proxy", "apple_proxy_likely"],
      likely_human_open_source: "click_inferred",
    }).map((badge) => badge.label);
    assert.deepEqual(labels, [
      "Muhtemelen otomatik (Apple Mail)",
      "Gmail üzerinden: tekrar açılmalar görünmez",
      "Güvenlik taraması olası",
      "Tıklamadan çıkarım",
    ]);
    assert.deepEqual(recipientBadges({ source_classes: ["mail_client"], likely_human_open_source: "open" }), []);
  });

  it("says why there is no likely real open", () => {
    assert.equal(noLikelyOpenText({ tracked: false, automated_only: false, first_open_at: null }), "Takip edilmedi");
    assert.equal(noLikelyOpenText({ tracked: true, automated_only: true, first_open_at: "2026-10-20T10:00:00Z" }), "Yalnız otomatik açılma");
    assert.equal(noLikelyOpenText({ tracked: true, automated_only: false, first_open_at: null }), "Açılma görülmedi");
  });
});

const point = (at: string, interval: "hour" | "day", opens = 0, automated = 0, clicks = 0, automatedClicks = 0): TrackingPoint => ({
  at,
  interval,
  likely_human_opens: opens,
  automated_opens: automated,
  likely_human_clicks: clicks,
  automated_clicks: automatedClicks,
});

describe("the series", () => {
  it("fills the hours and days the API left empty, hours first", () => {
    const rows = trackingSeries([
      point("2026-10-24T00:00:00Z", "day", 1),
      point("2026-10-20T09:00:00Z", "hour", 2, 3),
      point("2026-10-20T12:00:00Z", "hour", 0, 0, 1, 1),
      point("2026-10-26T00:00:00Z", "day", 0, 0, 2),
    ]);
    assert.deepEqual(
      rows.map((row) => [row.interval, row.at, row.likely_human_opens, row.automated_opens, row.clicks]),
      [
        ["hour", "2026-10-20T09:00:00.000Z", 2, 3, 0],
        ["hour", "2026-10-20T10:00:00.000Z", 0, 0, 0],
        ["hour", "2026-10-20T11:00:00.000Z", 0, 0, 0],
        ["hour", "2026-10-20T12:00:00.000Z", 0, 0, 2],
        ["day", "2026-10-24T00:00:00.000Z", 1, 0, 0],
        ["day", "2026-10-25T00:00:00.000Z", 0, 0, 0],
        ["day", "2026-10-26T00:00:00.000Z", 0, 0, 2],
      ],
    );
  });

  it("labels an hour in the club's time and a day by its UTC date", () => {
    const [hour, day] = trackingSeries([point("2026-10-20T09:00:00Z", "hour", 1), point("2026-10-24T00:00:00Z", "day", 1)]);
    assert.match(hour.label, /20 Eki.*12:00/);
    assert.equal(day.label, "24 Eki");
  });

  it("is empty without points, and has events only when something happened", () => {
    assert.deepEqual(trackingSeries(undefined), []);
    assert.deepEqual(trackingSeries([]), []);
    assert.equal(seriesHasEvents(trackingSeries([point("2026-10-20T09:00:00Z", "hour")])), false);
    assert.equal(seriesHasEvents(trackingSeries([point("2026-10-20T09:00:00Z", "hour", 0, 1)])), true);
  });

  it("carries counts only, no person", () => {
    const [row] = trackingSeries([point("2026-10-20T09:00:00Z", "hour", 1)]);
    assert.deepEqual(Object.keys(row).sort(), ["at", "automated_opens", "clicks", "interval", "label", "likely_human_opens"]);
  });
});
