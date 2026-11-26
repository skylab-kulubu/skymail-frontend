/**
 * The Ticket status mails (kontenjan-iptal-hatirlatma 09, 10): what core-backend
 * sends when a Ticket is cancelled, put on or taken off the waiting list, when a
 * Forms answer meets a full event, and the reminder the day before. Each reads
 * exactly the variables core's ticket names, is a required system lane
 * Notification type by e-mail and the inbox, and shows a part only when its
 * variable is set.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

async function rendered(key: string) {
  const template = findTemplate(key);
  assert.ok(template, `${key} yok`);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${key} render edilmedi`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

const text = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ ([,.])/g, "$1")
    .trim();

async function received(key: string, vars: Record<string, unknown> = {}) {
  const { meta, html, plainText } = await rendered(key);
  const all = { ...meta.sample, ...vars };
  return {
    subject: fillSampleValues(meta.subject, all, { as: "text" }),
    html: text(fillSampleValues(html, all)),
    rawHtml: fillSampleValues(html, all),
    plainText: fillSampleValues(plainText, all, { as: "text" }),
  };
}

/** The variables core-backend sends for each key (SPEC §3.5, §3.6; core tickets 04, 06, 07, 08; Theme and EventBannerUrl: etkinlik teması T3). */
const CORE: Record<string, string[]> = {
  "event.ticket-cancelled": ["CancelledBy", "EventBannerUrl", "EventDate", "EventId", "EventName", "OwnerTeam", "Reason", "Theme"],
  "event.waitlist-joined": ["EventDate", "EventId", "EventName", "OwnerTeam", "TicketUrl", "Venue"],
  "event.waitlist-promoted": ["EventDate", "EventId", "EventName", "OwnerTeam", "TicketCode", "TicketQrUrl", "TicketUrl", "Venue"],
  "event.registration-full": ["EventDate", "EventId", "EventName", "OwnerTeam"],
  "event.reminder": ["EventBannerUrl", "EventId", "EventName", "MapUrl", "OwnerTeam", "StartsAt", "Theme", "TicketCode", "TicketQrUrl", "TicketUrl", "Venue"],
};

const SUBJECTS: Record<string, string> = {
  "event.ticket-cancelled": "GECEKODU 2026 biletin iptal edildi",
  "event.waitlist-joined": "GECEKODU 2026: bekleme listesindesin",
  "event.waitlist-promoted": "Yer açıldı: GECEKODU 2026 biletin hazır",
  "event.registration-full": "GECEKODU 2026 kontenjanı doldu",
  "event.reminder": "Yarın: GECEKODU 2026",
};

const SLOP = ["!", "endişelenme", "merak etme", "teşekkür", "Harika", "🎉"];

describe("the Ticket status mails and the reminder", () => {
  for (const key of Object.keys(CORE)) {
    it(`${key} reads what core sends, and EventId only for the inbox`, async () => {
      const { meta, html } = await rendered(key);
      assert.equal(meta.system, false);
      assert.deepEqual([...meta.variables].sort(), CORE[key]);
      assert.deepEqual(Object.keys(meta.sample).sort(), CORE[key]);
      const referenced = [...referencedVariables(html)].filter((name) => name !== "UnsubscribeUrl");
      assert.deepEqual(referenced.sort(), CORE[key].filter((name) => name !== "EventId"));
    });

    it(`${key} is a required, system lane Notification type by e-mail and the inbox`, async () => {
      const { meta } = await rendered(key);
      const n = meta.notification;
      assert.ok(n, `${key}: Bildirim türü yok`);
      assert.deepEqual(
        { required: n.required, lane: n.lane, channels: n.defaultChannels, category: n.category },
        { required: true, lane: "system", channels: ["email", "inbox"], category: null },
      );
      assert.equal(n.inbox?.link, "/events/{{.EventId}}");
      assert.equal(n.inbox?.title, meta.subject);
    });

    it(`${key} has a short subject and plain words`, async () => {
      const mail = await received(key);
      assert.equal(mail.subject, SUBJECTS[key]);
      for (const body of [mail.html, mail.plainText]) {
        for (const word of SLOP) assert.ok(!body.includes(word), `${key}: "${word}"`);
      }
    });
  }
});

describe("the cancellation mail (event.ticket-cancelled)", () => {
  it("says who cancelled and the organizer's reason", async () => {
    const operator = await received("event.ticket-cancelled", { CancelledBy: "operator", Reason: "Aynı kişiye iki bilet." });
    for (const body of [operator.html, operator.plainText]) {
      assert.match(body, /Düzenleyen, GECEKODU 2026 biletini iptal etti\./);
      assert.match(body, /Gerekçe\s+Aynı kişiye iki bilet\./);
      assert.doesNotMatch(body, /iptal ettin/);
    }
    const holder = await received("event.ticket-cancelled", { CancelledBy: "holder", Reason: "" });
    for (const body of [holder.html, holder.plainText]) {
      assert.match(body, /GECEKODU 2026 biletini iptal ettin\./);
      assert.doesNotMatch(body, /Düzenleyen,|Gerekçe/);
    }
  });

  it("offers no way to register again", async () => {
    const { rawHtml } = await received("event.ticket-cancelled");
    assert.doesNotMatch(rawHtml, /\/bilet\/|Yeniden kayıt|Kaydol/);
  });
});

describe("the waiting list mails", () => {
  it("event.waitlist-joined says what happens when a place opens and links the Ticket page to leave", async () => {
    const mail = await received("event.waitlist-joined");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /kontenjanı dolu\. Yer açılır ve sıra sana gelirse biletin kendiliğinden oluşur/);
      assert.match(body, /Listeden çık/);
    }
    assert.match(mail.rawHtml, /href="https:\/\/yildizskylab\.com\/bilet\/7Q2MK4XRWZ3HN5TJVB6PDYCGEA"[^>]*>\s*Listeden çık/);
    const without = await received("event.waitlist-joined", { TicketUrl: "" });
    assert.doesNotMatch(without.html, /Listeden çık/);
  });

  it("event.waitlist-promoted shows the Ticket as event.ticket-created does, and the way out", async () => {
    const mail = await received("event.waitlist-promoted");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /Yer açıldı, bekleme listesinde sıra sana geldi\./);
      assert.match(body, /K7M2-QX9F/);
      assert.match(body, /Biletini aç/);
      assert.match(body, /Gelemeyecek misin\? Biletini iptal et/);
      assert.match(body, /fotoğraf ve video çekilir/);
    }
    assert.match(mail.rawHtml, /qr\.png/);
    const none = await received("event.waitlist-promoted", { TicketUrl: "", TicketQrUrl: "", TicketCode: "" });
    for (const body of [none.html, none.plainText]) {
      assert.doesNotMatch(body, /K7M2|Biletini aç|Biletini iptal et|Bilet kodu/);
    }
    const noQr = await received("event.waitlist-promoted", { TicketQrUrl: "" });
    assert.match(noQr.html, /Bilet kodu K7M2-QX9F/);
  });

  it("event.registration-full says the answer made no Ticket", async () => {
    const mail = await received("event.registration-full");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /GECEKODU 2026 kontenjanı dolu olduğu için başvurundan bilet oluşmadı\./);
    }
  });
});

describe("the reminder (event.reminder)", () => {
  it("is sent the day before at 18:00 by core, as a mail the person cannot turn off", async () => {
    const { meta } = await rendered("event.reminder");
    assert.match(meta.trigger, /önceki gün 18:00/);
    assert.match(meta.trigger, /EVENT_REMINDER_NOTIFICATION=on/);
    assert.doesNotMatch(meta.trigger, /henüz yazılmadı/);
    assert.deepEqual(meta.sensitiveVariables, ["TicketCode", "TicketQrUrl", "TicketUrl"]);
    assert.equal(meta.notification?.inbox?.summary, "{{.StartsAt}}{{if .Venue}} · {{.Venue}}{{end}}");
  });

  it("carries the organizer, the Ticket, the way and the way out", async () => {
    const mail = await received("event.reminder");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /Düzenleyen\s+WEBLAB/);
      assert.match(body, /K7M2-QX9F/);
      assert.match(body, /Biletini aç/);
      assert.match(body, /Yol Tarifi/);
      assert.match(body, /Gelemeyecek misin\? Biletini iptal et/);
    }
  });

  it("leaves out each part whose variable is empty", async () => {
    const mail = await received("event.reminder", { TicketUrl: "", TicketQrUrl: "", TicketCode: "", MapUrl: "", OwnerTeam: "", Venue: "" });
    for (const body of [mail.html, mail.plainText]) {
      assert.doesNotMatch(body, /K7M2|Biletini aç|Biletini iptal et|Yol Tarifi|Düzenleyen|Yer\b/);
      assert.match(body, /Başlangıç\s+12\.04\.2026 10:00/);
    }
  });
});
