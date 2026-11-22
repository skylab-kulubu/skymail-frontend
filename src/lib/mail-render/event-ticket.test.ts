/**
 * The mails that carry an event Ticket (bilet-qr-ve-pdf 06): event.ticket-created
 * and event.updated show the Ticket's QR, code and page link when core sends
 * them (TICKET_PAGE_URL on), and read as before when it does not. No
 * instructions in any of them, the reminder included (Yusuf, 2026-11-22): data
 * and the photo notice only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTemplate } from "../../../emails";
import { fillSampleValues, renderComponent } from ".";

async function rendered(key: string) {
  const template = findTemplate(key);
  assert.ok(template, `${key} yok`);
  const result = await renderComponent(template.Component);
  assert.ok(result.ok, `${key} render edilmedi`);
  return { meta: template.meta, html: result.html, plainText: result.plainText };
}

/** The visible text of a filled body, one string. */
const text = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<div[^>]*data-skip-in-text[^>]*>[\s\S]*?<\/div>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const KEY = "7Q2MK4XRWZ3HN5TJVB6PDYCGEA";
const TICKET = {
  TicketUrl: `https://yildizskylab.com/bilet/${KEY}`,
  TicketQrUrl: `https://api.yildizskylab.com/v1/public/tickets/${KEY}/qr.png`,
  TicketCode: "K7M2-QX9F",
};

/** What core sends with TICKET_PAGE_URL unset (core-backend docs/ticket-created-notification.md). */
const CREATED_BEFORE = {
  EventId: "3f1c0000-0000-4000-8000-000000000000",
  EventName: "GECEKODU 2026",
  EventDate: "12.04.2026 10:00",
  Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
  OwnerTeam: "WEBLAB",
};

const UPDATED_BEFORE = {
  EventId: "3f1c0000-0000-4000-8000-000000000000",
  EventName: "GECEKODU 2026",
  ChangeSummary: "Etkinliğin saati değişti.",
  NewStartsAt: "13.04.2026 10:00",
  NewEndsAt: "13.04.2026 18:00",
  NewVenue: "YTÜ Davutpaşa Kampüsü, D-Blok",
};

// Instructions the mails carried before 2026-11-22, and their kin.
const INSTRUCTIONS = ["göster", "okut", "söyle", "telefonunla", "görevliye", "giremezsen", "Kapıda"];

function assertNoInstructions(key: string, body: string) {
  for (const word of INSTRUCTIONS) {
    assert.ok(!body.includes(word), `${key}: talimat kalmış (${word})`);
  }
}

function assertNoTicket(body: string, html?: string) {
  for (const value of [KEY, TICKET.TicketCode, "Biletini aç", "Bilet kodu", "Bilet QR kodu"]) {
    assert.ok(!body.includes(value), `bilet parçası görünüyor: ${value}`);
  }
  if (html !== undefined) {
    assert.ok(!html.includes("qr.png") && !html.includes("/bilet/"), "bilet görseli ya da bağlantısı kalmış");
  }
}

describe("the ticket mail (event.ticket-created)", () => {
  it("marks the three Ticket variables sensitive and optional, and keeps the inbox text", async () => {
    const { meta } = await rendered("event.ticket-created");
    assert.equal(meta.contentSensitive, true);
    assert.deepEqual(meta.sensitiveVariables, ["TicketCode", "TicketQrUrl", "TicketUrl"]);
    assert.deepEqual(meta.requiredVariables ?? [], []);
    for (const name of Object.keys(TICKET)) {
      assert.ok(meta.variables.includes(name), `${name} değişkenlerde yok`);
    }
    assert.deepEqual(meta.notification?.inbox, {
      title: "{{.EventName}} biletin hazır",
      summary: "{{if .EventDate}}{{.EventDate}} · {{end}}{{.Venue}}",
      link: "/events/{{.EventId}}",
    });
  });

  it("reads as the event's rows and the photo notice alone when core sends no Ticket", async () => {
    const { html, plainText } = await rendered("event.ticket-created");
    const filled = fillSampleValues(html, CREATED_BEFORE);
    const body = text(filled);
    // A snapshot of what the recipient reads, footer aside.
    assert.equal(
      body.slice(0, body.indexOf("Sorun bildir")).trim(),
      "SKY LAB ● GECEKODU 2026 Biletin Hazır Etkinlik GECEKODU 2026 Tarih 12.04.2026 10:00 Yer YTÜ Davutpaşa Kampüsü, D-Blok Düzenleyen WEBLAB Etkinlikte fotoğraf ve video çekilir, Kulübün kanallarında paylaşılabilir.",
    );
    assertNoTicket(body, filled);
    const plain = fillSampleValues(plainText, CREATED_BEFORE, { as: "text" });
    assertNoTicket(plain);
    assertNoInstructions("event.ticket-created", body);
    assertNoInstructions("event.ticket-created", plain);
  });

  it("shows the QR on a white ground, the code under it and a plain link to the page", async () => {
    const { html, plainText } = await rendered("event.ticket-created");
    const filled = fillSampleValues(html, { ...CREATED_BEFORE, ...TICKET });
    const img = [...filled.matchAll(/<img[^>]*>/g)].map(([tag]) => tag).find((tag) => tag.includes(`src="${TICKET.TicketQrUrl}"`)) ?? "";
    assert.ok(img, "QR görseli yok");
    assert.ok(img.includes('alt="Bilet QR kodu"'));
    assert.ok(img.includes("background-color:#ffffff"), "QR beyaz zeminde değil");
    assert.ok(filled.includes(`href="${TICKET.TicketUrl}"`), "bilet sayfası bağlantısı yok");
    const body = text(filled);
    assert.ok(body.includes(`${TICKET.TicketCode} Biletini aç`), "kod QR'ın altında, bağlantı kodun altında değil");
    assert.ok(!body.includes("Bilet kodu"), "QR varken kod satırlara da yazılmış");
    assert.ok(body.indexOf("Biletini aç") < body.indexOf("Etkinlikte fotoğraf"), "KVKK satırı en altta değil");
    const plain = fillSampleValues(plainText, { ...CREATED_BEFORE, ...TICKET }, { as: "text" });
    assert.ok(plain.includes(TICKET.TicketCode));
    assert.ok(plain.includes(`Biletini aç ${TICKET.TicketUrl}`));
    assertNoInstructions("event.ticket-created", body);
  });

  it("puts the code into the rows when core sends no QR image", async () => {
    const { html } = await rendered("event.ticket-created");
    const filled = fillSampleValues(html, { ...CREATED_BEFORE, TicketUrl: TICKET.TicketUrl, TicketCode: TICKET.TicketCode });
    assert.ok(!filled.includes("qr.png"));
    const body = text(filled);
    assert.ok(body.includes(`Bilet kodu ${TICKET.TicketCode}`));
    assert.ok(body.includes("Biletini aç"));
  });

  it("escapes the values core sends", async () => {
    const { html } = await rendered("event.ticket-created");
    const filled = fillSampleValues(html, { ...CREATED_BEFORE, ...TICKET, TicketCode: "<b>x</b>" });
    assert.ok(filled.includes("&lt;b&gt;x&lt;/b&gt;"));
    assert.ok(!filled.includes("<b>x</b>"));
  });
});

describe("the event change mail (event.updated)", () => {
  it("marks the Ticket variables sensitive and optional", async () => {
    const { meta } = await rendered("event.updated");
    assert.equal(meta.contentSensitive, true);
    assert.deepEqual(meta.sensitiveVariables, ["TicketCode", "TicketQrUrl", "TicketUrl"]);
    assert.deepEqual(meta.requiredVariables ?? [], []);
    assert.deepEqual(meta.notification?.inbox, {
      title: "{{.EventName}} etkinliğinde değişiklik var",
      summary: "{{.ChangeSummary}} {{if .NewStartsAt}}{{.NewStartsAt}} · {{end}}{{.NewVenue}}",
      link: "/events/{{.EventId}}",
    });
  });

  it("reads as before when core sends no Ticket", async () => {
    const { html } = await rendered("event.updated");
    const filled = fillSampleValues(html, UPDATED_BEFORE);
    const body = text(filled);
    assert.equal(
      body.slice(0, body.indexOf("Sorun bildir")).trim(),
      "SKY LAB ● GECEKODU 2026 Etkinlikte Değişiklik Var GECEKODU 2026 etkinliğinde değişiklik var. Biletin geçerli. Ne değişti Etkinliğin saati değişti. Başlangıç 13.04.2026 10:00 Bitiş 13.04.2026 18:00 Yer YTÜ Davutpaşa Kampüsü, D-Blok",
    );
    assertNoTicket(body, filled);
  });

  it("shows the link and the code core sends today, and the QR if it ever sends one", async () => {
    const { html } = await rendered("event.updated");
    const today = text(fillSampleValues(html, { ...UPDATED_BEFORE, TicketUrl: TICKET.TicketUrl, TicketCode: TICKET.TicketCode }));
    assert.ok(today.includes(`Bilet kodu ${TICKET.TicketCode}`));
    assert.ok(today.includes("Biletini aç Sorun bildir"), "bağlantı satırların altında değil");
    const filled = fillSampleValues(html, { ...UPDATED_BEFORE, ...TICKET });
    assert.ok(filled.includes(`src="${TICKET.TicketQrUrl}"`));
    assert.ok(filled.includes(`href="${TICKET.TicketUrl}"`));
    assert.ok(text(filled).includes(`${TICKET.TicketCode} Biletini aç`));
    assertNoInstructions("event.updated", text(filled));
  });
});

describe("the reminder (event.reminder)", () => {
  it("carries no instructions", async () => {
    const { meta, html, plainText } = await rendered("event.reminder");
    assertNoInstructions("event.reminder", text(fillSampleValues(html, meta.sample)));
    assertNoInstructions("event.reminder", fillSampleValues(plainText, meta.sample, { as: "text" }));
  });
});
