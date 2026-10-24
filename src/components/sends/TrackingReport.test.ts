/**
 * The "Açılma ve tıklama" section of a send (hub ticket iletisim-servisi 15b)
 * as the server renders it: the caveat once, the counts, the links, the
 * recipients with their marks, the empty state, and a year-old send's kept
 * totals. The data is made up; no real person is in it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SkylcnProvider } from "@skylab-kulubu/skylcn-ui";
import { TRACKING_CAVEAT, TRACKING_EXPIRED_TEXT, TRACKING_WITHHELD_TEXT, type TrackingRecipientPage, type TrackingSummary } from "@/lib/tracking-report";
import { TrackingOverview, TrackingRecipientsView } from "./TrackingReport";

const render = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(SkylcnProvider, { locale: "tr", children: element }));

/** The visible words, tags removed. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const SUMMARY: TrackingSummary = {
  tracking_available: true,
  tracking_requested: true,
  retained: false,
  report: {
    tracked_recipients: 40,
    untracked_by_reason: { no_account: 3, preference_off: 2 },
    unique_opens: 22,
    unique_likely_human_opens: 16,
    automated_only_recipients: 6,
    unique_clickers: 9,
    clicks_by_link: [
      { id: 12, position: 1, clicks: 4, unique_clickers: 3 },
      { id: 11, position: 0, clicks: 11, unique_clickers: 8 },
    ],
    series: [
      { at: "2026-10-20T09:00:00Z", interval: "hour", likely_human_opens: 5, automated_opens: 6, likely_human_clicks: 2, automated_clicks: 0 },
    ],
  },
};

describe("counts withheld from the reader", () => {
  // skymail-backend GetTracking: a send to fewer than 10 tracked people, or
  // mail the system sends, to one who may not read its people.
  for (const retained of [false, true]) {
    it(`says why there are no counts, and shows none${retained ? ", a year on too" : ""}`, () => {
      const words = text(render(createElement(TrackingOverview, { summary: { ...SUMMARY, retained, withheld: true, report: null } })));
      assert.match(words, new RegExp(TRACKING_WITHHELD_TEXT.replace(/[.;]/g, "\\$&")));
      assert.doesNotMatch(words, /Takip edilen|takip bilgisi yok/);
    });
  }

  it("shows the counts as before when the backend does not say", () => {
    assert.doesNotMatch(text(render(createElement(TrackingOverview, { summary: SUMMARY }))), new RegExp(TRACKING_WITHHELD_TEXT.slice(0, 20)));
  });
});

describe("the overview", () => {
  const html = render(createElement(TrackingOverview, { summary: SUMMARY }));
  const words = text(html);

  it("says once that an open is not certain", () => {
    assert.equal(words.split(TRACKING_CAVEAT).length - 1, 1);
  });

  it("counts the tracked, the untracked with their reasons, the opens and the clickers", () => {
    assert.match(words, /Takip edilen 40/);
    assert.match(words, /Takip edilmeyen 5 Hesabı yok: 3 · Takibi kapatmış: 2/);
    assert.match(words, /Açılma görülen 16 Takip edilenlere oranı: %40/);
    assert.match(words, /Yalnız otomatik açılma 6/);
    assert.match(words, /Tıklayan 9/);
  });

  it("lists the links by their place in the mail, never an address", () => {
    assert.ok(words.indexOf("1. bağlantı 8 11") < words.indexOf("2. bağlantı 3 4"));
    assert.doesNotMatch(words, /https?:\/\//);
  });

  it("titles the series", () => {
    assert.match(words, /Zaman içinde/);
    assert.match(words, /İlk 72 saat saatlik, sonrası günlük/);
  });

  it("before anything happened, says so instead of a chart", () => {
    const empty = text(
      render(
        createElement(TrackingOverview, {
          summary: {
            ...SUMMARY,
            report: { ...SUMMARY.report!, unique_opens: 0, unique_likely_human_opens: 0, automated_only_recipients: 0, unique_clickers: 0, clicks_by_link: [], series: [] },
          },
        }),
      ),
    );
    assert.match(empty, /Henüz açılma ya da tıklama görülmedi\./);
    assert.match(empty, /Bu postada takip edilen bağlantı yok\./);
  });
});

describe("90 days after the last mail", () => {
  it("says the per-person record is gone and shows the kept totals", () => {
    const kept = { ...SUMMARY.report!, series: undefined, automated_only_recipients: undefined };
    const words = text(render(createElement(TrackingOverview, { summary: { ...SUMMARY, retained: true, report: kept } })));
    assert.match(words, new RegExp(TRACKING_EXPIRED_TEXT.replace(/\./g, "\\.")));
    assert.match(words, /Takip edilen 40/);
    assert.doesNotMatch(words, /Zaman içinde/);
    assert.doesNotMatch(words, /Yalnız otomatik açılma/);
    assert.doesNotMatch(words, new RegExp(TRACKING_CAVEAT.slice(0, 20)));
  });

  it("without kept totals, says why", () => {
    const words = text(render(createElement(TrackingOverview, { summary: { ...SUMMARY, retained: true, report: null } })));
    assert.match(words, /90 gün doldu/);
    assert.match(words, /Kişi bazında kayıt 90 gün sonra silindi\./);
    assert.match(words, /10'dan az takipli alıcılı gönderimin toplamı 1 yıl sonra silinir\./);
  });
});

const PAGE: TrackingRecipientPage = {
  tracking_available: true,
  page: 1,
  page_size: 25,
  total: 3,
  items: [
    {
      id: "q-1",
      recipient_sub: "4c2a9e17-5b3d-4f60-8a21-7e9d0c3b5f12",
      recipient_email: "deneme.bir@example.test",
      recipient_full_name: "Deneme Bir",
      tracked: true,
      tracking_skip_reason: null,
      first_open_at: "2026-10-20T09:00:05Z",
      first_likely_human_open_at: "2026-10-20T11:30:00Z",
      likely_human_open_source: "click_inferred",
      open_count: 1,
      last_clicked_at: "2026-10-20T11:30:00Z",
      automated_only: false,
      source_classes: ["apple_proxy_likely", "browser"],
      clicked_links: [{ link_id: 11, clicks: 2, last_clicked_at: "2026-10-20T11:30:00Z" }],
    },
    {
      id: "q-2",
      recipient_sub: "6f3b8d21-9a4c-4e7f-b2d0-3c8e5a1f7b64",
      recipient_email: "deneme.iki@example.test",
      recipient_full_name: "Deneme İki",
      tracked: true,
      tracking_skip_reason: null,
      first_open_at: "2026-10-20T09:00:02Z",
      first_likely_human_open_at: null,
      likely_human_open_source: null,
      open_count: 1,
      last_clicked_at: null,
      automated_only: true,
      source_classes: ["scanner_likely"],
      clicked_links: [],
    },
    {
      id: "q-3",
      recipient_sub: null,
      recipient_email: "deneme.uc@example.test",
      recipient_full_name: "Deneme Üç",
      tracked: false,
      tracking_skip_reason: "no_account",
      first_open_at: null,
      first_likely_human_open_at: null,
      likely_human_open_source: null,
      open_count: 0,
      last_clicked_at: null,
      automated_only: false,
      source_classes: [],
      clicked_links: [],
    },
  ],
};

describe("the recipients", () => {
  const view = (page: TrackingRecipientPage, filter: "all" | "clicked" = "all") =>
    text(
      render(
        createElement(TrackingRecipientsView, {
          page,
          links: SUMMARY.report!.clicks_by_link,
          filter,
          current: 1,
          onFilterChange: () => {},
          onPageChange: () => {},
        }),
      ),
    );
  const words = view(PAGE);

  it("heads the columns as the ticket names them", () => {
    for (const header of ["Alıcı", "İlk gerçek açılma", "İlk açılma", "Açılma", "Son tıklama", "Tıklanan bağlantılar", "İşaret"]) {
      assert.match(words, new RegExp(header));
    }
  });

  it("offers the four filters", () => {
    for (const label of ["Açılma görüldü", "Açılma görülmedi", "Tıkladı", "Yalnız otomatik"]) assert.match(words, new RegExp(label));
  });

  it("marks each row as the classifier saw it", () => {
    assert.match(words, /Deneme Bir deneme\.bir@example\.test/);
    assert.match(words, /Muhtemelen otomatik \(Apple Mail\)/);
    assert.match(words, /Tıklamadan çıkarım/);
    assert.match(words, /1\. bağlantı \(2\)/);
    assert.match(words, /Yalnız otomatik açılma/);
    assert.match(words, /Güvenlik taraması olası/);
    assert.match(words, /Takip edilmedi: Hesabı yok/);
  });

  it("says when a filter has no one", () => {
    assert.match(view({ ...PAGE, total: 0, items: [] }, "clicked"), /Tıklayan alıcı yok\./);
  });
});
