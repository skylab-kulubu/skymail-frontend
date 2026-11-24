import * as React from "react";
import { Img } from "@react-email/components";
import { Context, Cta, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, TextLink, Title } from "./theme";
import { end, ifNotSet, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.reminder",
  name: "Etkinlik · Hatırlatma",
  subject: `Yarın: ${v("EventName")}`,
  system: false,
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, etkinlikten önceki gün 18:00'de (İstanbul), başlangıcı ertesi gün olan, yayında, arşivsiz ve iptal edilmemiş etkinliklerin etkin bileti olan herkesine bir kez; aynı adresin biletleri tek posta (EVENT_REMINDER_NOTIFICATION=on, SKYMAIL_EVENT_REMINDER_TEMPLATE_KEY; docs/event-reminder.md). İşlem postası, kapatılamaz. Çok günlü etkinlikte yalnız ilk günden önce. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), misafire yalnız bu e-posta (POST /v1/mail_tasks/single). Her değişken her zaman gelir, boş olabilir: TicketUrl, TicketQrUrl ve TicketCode TICKET_PAGE_URL açıkken dolu; MapUrl bilet sayfasının yol tarifi. EventId yalnız kutu bağlantısı içindir.",
  // core-backend kontenjan-iptal-hatirlatma 08 (SPEC §3.5).
  variables: ["EventId", "EventName", "StartsAt", "Venue", "OwnerTeam", "TicketUrl", "TicketQrUrl", "TicketCode", "MapUrl"],
  sensitiveVariables: ["TicketCode", "TicketQrUrl", "TicketUrl"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    inbox: {
      title: `Yarın: ${v("EventName")}`,
      summary: `${v("StartsAt")}${ifSet("Venue")} · ${v("Venue")}${end}`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    StartsAt: "12.04.2026 10:00",
    Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
    OwnerTeam: "WEBLAB",
    TicketUrl: "https://yildizskylab.com/bilet/7Q2MK4XRWZ3HN5TJVB6PDYCGEA",
    TicketQrUrl: "https://api.yildizskylab.com/v1/public/tickets/7Q2MK4XRWZ3HN5TJVB6PDYCGEA/qr.png",
    TicketCode: "K7M2-QX9F",
    MapUrl: "https://maps.app.goo.gl/ornek",
  },
};

/**
 * The event's rows and the Ticket as event.ticket-created shows it, each part
 * only when core sends it; the way out last (the cancel button is on the
 * Ticket page). Data only, no instructions (Yusuf, 2026-11-22).
 */
export default function EventReminder() {
  return (
    <Shell preview={`${v("EventName")} yarın başlıyor.`} brand="skylab" reason={null}>
      <Context tone="wait">{v("EventName")}</Context>
      <Title>Etkinlik Yarın</Title>

      <Rows>
        {ifSet("StartsAt")}
        <RowItem label="Başlangıç">{v("StartsAt")}</RowItem>
        {end}
        {ifSet("Venue")}
        <RowItem label="Yer">{v("Venue")}</RowItem>
        {end}
        {ifSet("OwnerTeam")}
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        {end}
        {ifSet("TicketCode")}
        {ifNotSet("TicketQrUrl")}
        <RowItem label="Bilet kodu">{v("TicketCode")}</RowItem>
        {end}
        {end}
        <RowsEnd />
      </Rows>

      {ifSet("TicketQrUrl")}
      <div style={{ marginTop: "28px", textAlign: "center" }}>
        <Img
          src={v("TicketQrUrl")}
          width="160"
          height="160"
          alt="Bilet QR kodu"
          style={{ margin: "0 auto", borderRadius: "8px", backgroundColor: "#ffffff", padding: "12px", border: "1px solid #e5e5e5" }}
        />
        {ifSet("TicketCode")}
        <Paragraph style={{ textAlign: "center" }}>{v("TicketCode")}</Paragraph>
        {end}
      </div>
      {end}

      {ifSet("TicketUrl")}
      <Paragraph style={{ margin: "16px 0 0", textAlign: "center" }}>
        <TextLink href={v("TicketUrl")}>Biletini aç</TextLink>
      </Paragraph>
      {end}

      {ifSet("MapUrl")}
      <Cta href={v("MapUrl")}>Yol Tarifi</Cta>
      {end}

      {ifSet("TicketUrl")}
      <Small style={{ marginTop: "24px" }}>
        Gelemeyecek misin? <TextLink href={v("TicketUrl")}>Biletini iptal et</TextLink>
      </Small>
      {end}
    </Shell>
  );
}
