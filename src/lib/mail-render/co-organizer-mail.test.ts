/**
 * The Co-organizer mails (core-backend docs/co-organizers.md#mails, #464):
 * core.event-co-organizer-added and -removed, to a person added to or removed
 * from an Event's Co-organizers, or to the Leaders of a team added or removed.
 * Each declares exactly the variables core passes (internal/coorganizermail
 * vars), every one always sent, maybe empty; its inbox text reads only those
 * (SkyNotify renders it with missingkey=error). An internal mail to the team:
 * the club's look, no event theme (etkinlik teması plan §3.2).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, referencedVariables, renderComponent } from ".";

const KEYS = ["core.event-co-organizer-added", "core.event-co-organizer-removed"];

/** core-backend internal/coorganizermail Service.vars: every key, every send. */
const CORE = ["ActorName", "EventId", "EventName", "Management", "OwnerTeam", "PanelUrl", "TeamName", "Visibility"];

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
    .replace(/ ([,.;])/g, "$1")
    .trim();

/** A person's mail: core sends the team's variables empty. */
const PERSON = { TeamName: "", Management: "", Visibility: "" };

async function received(key: string, vars: Record<string, unknown> = {}) {
  const { meta, html, plainText } = await rendered(key);
  const all = { ...meta.sample, ...vars };
  const inbox = meta.notification?.inbox;
  return {
    subject: fillSampleValues(meta.subject, all, { as: "text" }),
    inboxTitle: inbox ? fillSampleValues(inbox.title, all, { as: "text" }) : "",
    inboxSummary: inbox ? fillSampleValues(inbox.summary, all, { as: "text" }) : "",
    html: text(fillSampleValues(html, all)),
    rawHtml: fillSampleValues(html, all),
    plainText: text(fillSampleValues(plainText, all, { as: "text" })),
  };
}

const SLOP = ["!", "endişelenme", "merak etme", "teşekkür", "Harika", "🎉"];

describe("the Co-organizer mails", () => {
  for (const key of KEYS) {
    it(`${key} declares exactly what core sends`, async () => {
      const { meta } = await rendered(key);
      assert.deepEqual([...meta.variables].sort(), CORE);
      assert.deepEqual(Object.keys(meta.sample).sort(), CORE);
      assert.equal(meta.system, true);
      assert.equal(meta.contentSensitive, false);
      assert.equal(meta.sensitiveVariables, undefined);
      assert.deepEqual((meta.requiredVariables ?? []).map(({ name }) => name), ["EventName"]);
    });

    it(`${key} is a required, system lane Notification type by e-mail and the inbox, its text from what core sends`, async () => {
      const { meta } = await rendered(key);
      const n = meta.notification;
      assert.ok(n?.inbox, `${key}: Bildirim türü yok`);
      assert.deepEqual(
        { required: n.required, lane: n.lane, channels: n.defaultChannels, category: n.category },
        { required: true, lane: "system", channels: ["email", "inbox"], category: null },
      );
      assert.equal(n.inbox.link, "/events/{{.EventId}}");
      assert.equal(n.inbox.title, meta.subject);
      for (const part of [meta.subject, n.inbox.title, n.inbox.summary, n.inbox.link]) {
        for (const name of referencedVariables(part)) assert.ok(CORE.includes(name), `${key}: ${name} core'dan gelmiyor`);
      }
    });

    it(`${key} reads only what core sends, and carries no event theme`, async () => {
      const { html, plainText } = await rendered(key);
      for (const body of [html, plainText]) {
        for (const name of referencedVariables(body)) {
          assert.ok(CORE.includes(name) || name === "UnsubscribeUrl", `${key}: ${name} core'dan gelmiyor`);
        }
        assert.ok(!body.includes(".Theme") && !body.includes("EventBannerUrl") && !body.includes("ARTLAB"), `${key}: tema taşıyor`);
      }
    });

    it(`${key} has plain words`, async () => {
      for (const vars of [{}, PERSON]) {
        const mail = await received(key, vars);
        for (const body of [mail.html, mail.plainText]) {
          for (const word of SLOP) assert.ok(!body.includes(word), `${key}: "${word}"`);
        }
      }
    });
  }
});

describe("the added mail (core.event-co-organizer-added)", () => {
  it("tells a team's Leaders their team was added, with its choices, and links the panel", async () => {
    const mail = await received("core.event-co-organizer-added");
    assert.equal(mail.subject, "GECEKODU 2026: ekibin etkinliğe eklendi");
    assert.equal(mail.inboxTitle, mail.subject);
    assert.equal(mail.inboxSummary, "Ekip: WEBLAB · Web Geliştirme");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /WEBLAB · Web Geliştirme ekibi GECEKODU 2026 etkinliğinin düzenleyenlerine eklendi\. Etkinliği panelden yönetebilirsiniz\./);
      assert.match(body, /Düzenleyen\s+SKY LAB: Bilgisayar Bilimleri Kulübü/);
      assert.match(body, /Ekibin rolü\s+ortak düzenleyen/);
      assert.match(body, /Ekipte yöneten\s+yalnız liderler/);
      assert.match(body, /Ekleyen\s+Ada Lovelace/);
      assert.match(body, /Etkinliği Panelde Aç/);
    }
    assert.match(mail.rawHtml, /href="https:\/\/admin\.yildizskylab\.com\/events\/6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19"/);
  });

  it("tells a person they were added, and when their rights end", async () => {
    const mail = await received("core.event-co-organizer-added", PERSON);
    assert.equal(mail.subject, "GECEKODU 2026: ortak düzenleyen oldun");
    assert.equal(mail.inboxSummary, "Düzenleyen: SKY LAB: Bilgisayar Bilimleri Kulübü");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /GECEKODU 2026 etkinliğine ortak düzenleyen olarak eklendin\. Etkinliği panelden yönetebilirsin; yetkin etkinlik bittikten 30 gün sonra sona erer\./);
      assert.doesNotMatch(body, /ekibi|Ekibin rolü|Ekipte yöneten/);
    }
  });

  it("leaves out the button without PANEL_URL and the actor who may no longer be named", async () => {
    const mail = await received("core.event-co-organizer-added", { PanelUrl: "", ActorName: "" });
    for (const body of [mail.html, mail.plainText]) assert.doesNotMatch(body, /Etkinliği Panelde Aç|Ekleyen/);
    assert.doesNotMatch(mail.rawHtml, /admin\.yildizskylab\.com/);
  });
});

describe("the removed mail (core.event-co-organizer-removed)", () => {
  it("tells a team's Leaders their team was removed, with no button", async () => {
    const mail = await received("core.event-co-organizer-removed");
    assert.equal(mail.subject, "GECEKODU 2026: ekibin etkinlikten çıkarıldı");
    assert.equal(mail.inboxSummary, "Ekip: WEBLAB · Web Geliştirme");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /WEBLAB · Web Geliştirme ekibi GECEKODU 2026 etkinliğinin düzenleyenlerinden çıkarıldı\./);
      assert.match(body, /Çıkaran\s+Ada Lovelace/);
      assert.doesNotMatch(body, /Panelde Aç|Ekibin rolü|Ekipte yöneten/);
    }
    assert.doesNotMatch(mail.rawHtml, /admin\.yildizskylab\.com/);
  });

  it("tells a person they were removed", async () => {
    const mail = await received("core.event-co-organizer-removed", { ...PERSON, ActorName: "" });
    assert.equal(mail.subject, "GECEKODU 2026: artık ortak düzenleyen değilsin");
    for (const body of [mail.html, mail.plainText]) {
      assert.match(body, /GECEKODU 2026 etkinliğinin ortak düzenleyenlerinden çıkarıldın\./);
      assert.doesNotMatch(body, /Çıkaran/);
    }
  });
});
