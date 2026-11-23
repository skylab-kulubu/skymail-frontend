import * as React from "react";
import { Img } from "@react-email/components";
import { Context, Cta, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, TextLink, Title } from "./theme";
import { end, ifNotSet, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.ticket-created",
  name: "Etkinlik · Bilet Oluşturuldu",
  subject: `${v("EventName")} biletin hazır`,
  system: false,
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, Member apply / Guest apply / Apply-for-other bir Ticket yazdığında, yayında ve bitmemiş bir etkinlikte (TICKET_CREATED_NOTIFICATION=on; docs/ticket-created-notification.md), ve panelden yeniden gönderimde. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), konuğa yalnız bu e-posta. TICKET_PAGE_URL açıkken core TicketUrl (bilet sayfası), TicketQrUrl (QR görseli; PUBLIC_API_ORIGIN boşsa boş) ve TicketCode da gönderir; kapalıyken göndermez ve satırları görünmez. EventUrl hiç gönderilmez.",
  variables: ["EventName", "EventDate", "Venue", "TicketQrUrl", "TicketCode", "TicketUrl", "OwnerTeam", "EventUrl"],
  sensitiveVariables: ["TicketCode", "TicketQrUrl", "TicketUrl"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    // core always sends EventId, EventName, EventDate (empty without a
    // start), Venue and OwnerTeam: the inbox text reads only those.
    inbox: {
      title: `${v("EventName")} biletin hazır`,
      summary: `${ifSet("EventDate")}${v("EventDate")} · ${end}${v("Venue")}`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventName: "GECEKODU 2026",
    EventDate: "12–13 Nisan 2026, 10:00",
    Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
    TicketQrUrl: "https://api.yildizskylab.com/v1/public/tickets/7Q2MK4XRWZ3HN5TJVB6PDYCGEA/qr.png",
    TicketCode: "K7M2-QX9F",
    TicketUrl: "https://yildizskylab.com/bilet/7Q2MK4XRWZ3HN5TJVB6PDYCGEA",
    OwnerTeam: "WEBLAB",
    EventUrl: "https://skyl.app/gecekodu",
  },
};

/**
 * The Ticket as the mail carries it (ADR 0082): the QR on a white ground, the
 * code under it and a plain link to the Ticket page, as the page's pass shows
 * them. Only data, no instructions (Yusuf, 2026-11-22). core sends the three
 * only while TICKET_PAGE_URL is set; without them the mail is the event's rows
 * and nothing more. The link is the page's bearer key, so all three are
 * sensitive. With images blocked the QR's alt text stands in its place and
 * the code and the link still work; a code without a QR goes into the rows.
 */
export default function EventTicketCreated() {
  return (
    <Shell preview={`${v("EventName")} biletin hazır.`} brand="skylab" reason={null}>
      <Context tone="ok">{v("EventName")}</Context>
      <Title>Biletin Hazır</Title>

      <Rows>
        <RowItem label="Etkinlik">{v("EventName")}</RowItem>
        {ifSet("EventDate")}
        <RowItem label="Tarih">{v("EventDate")}</RowItem>
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

      {/* The QR keeps a white ground of its own: a scanner needs the contrast in either theme. */}
      {ifSet("TicketQrUrl")}
      <div style={{ marginTop: "28px", textAlign: "center" }}>
        <Img
          src={v("TicketQrUrl")}
          width="180"
          height="180"
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

      {ifSet("EventUrl")}
      <Cta href={v("EventUrl")}>Etkinlik Sayfası</Cta>
      {end}

      {/* KVKK aydınlatma §5.12: the photo notice goes in the registration mail, fixed, before the footer. */}
      <Small style={{ marginTop: "24px" }}>Etkinlikte fotoğraf ve video çekilir, Kulübün kanallarında paylaşılabilir.</Small>
    </Shell>
  );
}
