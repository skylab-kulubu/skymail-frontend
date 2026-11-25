/**
 * The two event mails core-backend sends without a template so far
 * (etkinlik-bildirim-secenekleri b, c): event.changed, when an Event's other
 * details changed and its editor said to tell (core-backend #443), and
 * event.door-staff-added, to a person added to its door staff (#442). Each
 * reads exactly the variables core passes, its inbox text only those core
 * always passes (SkyNotify renders it with missingkey=error), and shows a part
 * only when its variable is set.
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

/**
 * What core-backend passes: internal/eventupdatenotify changedVars (+ TicketUrl
 * and TicketCode from withTicket while TICKET_PAGE_URL is set) and
 * internal/doorstaffmail vars.
 */
const CORE: Record<string, string[]> = {
  "event.changed": ["ChangeSummary", "ChangedFields", "EventId", "EventName", "StartsAt", "TicketCode", "TicketUrl", "Venue"],
  "event.door-staff-added": ["DoorUrl", "EndsAt", "EventId", "EventName", "FirstName", "StartsAt", "Venue"],
};

/** What core passes on every send: the inbox text may read only these. */
const ALWAYS: Record<string, string[]> = {
  "event.changed": ["ChangeSummary", "ChangedFields", "EventId", "EventName", "StartsAt", "Venue"],
  "event.door-staff-added": CORE["event.door-staff-added"],
};

const SUBJECTS: Record<string, string> = {
  "event.changed": "GECEKODU 2026 etkinliğinde değişiklik var",
  "event.door-staff-added": "GECEKODU 2026 etkinliğinde kapı görevlisisin",
};

const SLOP = ["!", "endişelenme", "merak etme", "teşekkür", "Harika", "🎉"];

describe("event.changed and event.door-staff-added", () => {
  for (const key of Object.keys(CORE)) {
    it(`${key} reads what core sends, and EventId only for the inbox`, async () => {
      const { meta, html } = await rendered(key);
      assert.equal(meta.system, false);
      assert.deepEqual([...meta.variables].sort(), CORE[key]);
      assert.deepEqual(Object.keys(meta.sample).sort(), CORE[key]);
      const referenced = [...referencedVariables(html)].filter((name) => name !== "UnsubscribeUrl");
      assert.deepEqual(referenced.sort(), CORE[key].filter((name) => name !== "EventId" && name !== "ChangeSummary"));
    });

    it(`${key} is a required, system lane Notification type by e-mail and the inbox, its text from what core always sends`, async () => {
      const { meta } = await rendered(key);
      const n = meta.notification;
      assert.ok(n?.inbox, `${key}: Bildirim türü yok`);
      assert.deepEqual(
        { required: n.required, lane: n.lane, channels: n.defaultChannels, category: n.category },
        { required: true, lane: "system", channels: ["email", "inbox"], category: null },
      );
      assert.equal(n.inbox.link, "/events/{{.EventId}}");
      assert.equal(n.inbox.title, meta.subject);
      for (const part of [n.inbox.title, n.inbox.summary, n.inbox.link]) {
        for (const name of referencedVariables(part)) {
          assert.ok(ALWAYS[key].includes(name), `${key}: kutu metni ${name} okuyor, core her zaman göndermiyor`);
        }
      }
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

describe("the details mail (event.changed)", () => {
  it("names the changed details and never their text", async () => {
    const { meta } = await rendered("event.changed");
    assert.equal(meta.notification?.inbox?.summary, "{{.ChangeSummary}}");
    // Yusuf, 2026-11-24 (ADR-0074 ek): no mask.
    assert.deepEqual(meta.sensitiveVariables, []);
    assert.equal(meta.contentSensitive, false);
    const mail = await received("event.changed");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /GECEKODU 2026 etkinliğinin açıklaması ve bağlantıları değişti\. Biletin geçerli\./);
      assert.match(body, /Başlangıç\s+12\.04\.2026 10:00/);
      assert.match(body, /Yer\s+YTÜ Davutpaşa Kampüsü, D-Blok/);
      assert.match(body, /Bilet kodu\s+K7M2-QX9F/);
      assert.match(body, /Güncel bilgileri gör/);
    }
    assert.match(mail.rawHtml, /href="https:\/\/yildizskylab\.com\/bilet\/7Q2MK4XRWZ3HN5TJVB6PDYCGEA"[^>]*>\s*Güncel bilgileri gör/);
  });

  it("leaves out the Ticket without TICKET_PAGE_URL, and each empty row", async () => {
    const mail = await received("event.changed", { TicketUrl: "", TicketCode: "", Venue: "" });
    for (const body of [mail.html, mail.plainText]) {
      assert.doesNotMatch(body, /K7M2|Bilet kodu|Güncel bilgileri gör|Yer\b/);
      assert.match(body, /Başlangıç\s+12\.04\.2026 10:00/);
    }
  });

  it("still reads without the list of fields", async () => {
    const mail = await received("event.changed", { ChangedFields: "" });
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /GECEKODU 2026 etkinliğinde değişiklik var\. Biletin geçerli\./);
      assert.doesNotMatch(body, /etkinliğinin/);
    }
  });
});

describe("the door staff mail (event.door-staff-added)", () => {
  it("tells the person their duty and links the panel's door page", async () => {
    const { meta } = await rendered("event.door-staff-added");
    assert.equal(meta.contentSensitive, false);
    assert.equal(meta.sensitiveVariables, undefined);
    assert.equal(meta.notification?.inbox?.summary, "{{if .StartsAt}}{{.StartsAt}}{{if .Venue}} · {{end}}{{end}}{{.Venue}}");
    const mail = await received("event.door-staff-added");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /Merhaba Ayşe, GECEKODU 2026 etkinliğine kapı görevlisi olarak eklendin\. Biletleri panelin kapı sayfasından okutabilirsin\./);
      assert.match(body, /Başlangıç\s+12\.04\.2026 10:00/);
      assert.match(body, /Bitiş\s+12\.04\.2026 18:00/);
      assert.match(body, /Yer\s+YTÜ Davutpaşa Kampüsü, D-Blok/);
      assert.match(body, /Kapı Sayfasını Aç/);
    }
    assert.match(mail.rawHtml, /href="https:\/\/admin\.yildizskylab\.com\/events\/6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19\/door"/);
  });

  it("leaves out the button without PANEL_URL, the greeting without a first name and each empty row", async () => {
    const mail = await received("event.door-staff-added", { DoorUrl: "", FirstName: "", EndsAt: "", Venue: "" });
    for (const body of [mail.html, mail.plainText]) {
      assert.doesNotMatch(body, /Kapı Sayfasını Aç|Merhaba|Bitiş|Yer\b/);
      assert.match(body, /GECEKODU 2026 etkinliğine kapı görevlisi olarak eklendin\./);
    }
    assert.doesNotMatch(mail.rawHtml, /\/door"/);
  });
});
