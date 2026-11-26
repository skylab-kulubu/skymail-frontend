import * as React from "react";
import { Img } from "@react-email/components";
import { Context, Cta, Note, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, TextLink, Title } from "./theme";
import { end, ifNotSet, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.updated",
  name: "Etkinlik · Güncellendi",
  subject: `${v("EventName")} etkinliğinde değişiklik var`,
  system: false,
  // The Ticket's link is a bearer key: the content is masked, the rows stay readable.
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, yayındaki ve bitmemiş bir etkinliğin başlangıcı, bitişi ya da yeri değişince, ilk değişiklikten 15 dakika sonra (aradaki değişiklikler tek bildirimde), bileti olan herkese (EVENT_UPDATED_NOTIFICATION=on; docs/event-updated-notification.md). Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), konuğa yalnız bu e-posta. Değerler gönderim anındaki etkinliktir. TICKET_PAGE_URL açıkken core alıcının biletinden TicketUrl (QR'ı yeni tarihle imzalanan bilet sayfası) ve TicketCode da gönderir; kapalıyken göndermez ve satırları görünmez. TicketQrUrl'yi core bugün bu postada göndermez; gönderirse QR görünür. EventUrl gönderilmez, düğme boşsa görünmez.",
  variables: ["EventName", "ChangeSummary", "NewStartsAt", "NewEndsAt", "NewVenue", "TicketQrUrl", "TicketCode", "TicketUrl", "EventUrl", "Theme", "EventBannerUrl"],
  sensitiveVariables: ["TicketCode", "TicketQrUrl", "TicketUrl"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    // core always sends EventId, EventName, ChangeSummary, NewStartsAt and
    // NewEndsAt (empty without a time) and NewVenue: the inbox text reads
    // only those.
    inbox: {
      title: `${v("EventName")} etkinliğinde değişiklik var`,
      summary: `${v("ChangeSummary")} ${ifSet("NewStartsAt")}${v("NewStartsAt")} · ${end}${v("NewVenue")}`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventName: "GECEKODU 2026",
    ChangeSummary: "Etkinliğin saati ve yeri değişti.",
    NewStartsAt: "13.04.2026 10:00",
    NewEndsAt: "13.04.2026 18:00",
    NewVenue: "YTÜ Davutpaşa Kampüsü, Kongre Merkezi",
    TicketQrUrl: "https://api.yildizskylab.com/v1/public/tickets/7Q2MK4XRWZ3HN5TJVB6PDYCGEA/qr.png",
    TicketCode: "K7M2-QX9F",
    TicketUrl: "https://yildizskylab.com/bilet/7Q2MK4XRWZ3HN5TJVB6PDYCGEA",
    EventUrl: "https://skyl.app/gecekodu",
    // The club's own look; "artlab" previews the ARTLAB theme.
    Theme: "",
    EventBannerUrl: "",
  },
};

/**
 * The Event as it is now: every row is today's value, ChangeSummary says which
 * one moved. The holder's Ticket follows as event.ticket-created shows it (QR,
 * code, plain link), each part only when core sends it.
 */
export default function EventUpdated() {
  return (
    <Shell preview={`${v("EventName")} etkinliğinde değişiklik var.`} brand="skylab" reason={null} themed>
      <Context tone="wait">{v("EventName")}</Context>
      <Title>Etkinlikte Değişiklik Var</Title>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> etkinliğinde değişiklik var. Biletin geçerli.
      </Paragraph>

      {ifSet("ChangeSummary")}
      <Note label="Ne değişti">{v("ChangeSummary")}</Note>
      {end}

      <Rows>
        {ifSet("NewStartsAt")}
        <RowItem label="Başlangıç">{v("NewStartsAt")}</RowItem>
        {end}
        {ifSet("NewEndsAt")}
        <RowItem label="Bitiş">{v("NewEndsAt")}</RowItem>
        {end}
        {ifSet("NewVenue")}
        <RowItem label="Yer">{v("NewVenue")}</RowItem>
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
      <Cta href={v("EventUrl")}>Güncel Bilgileri Gör</Cta>
      {end}
    </Shell>
  );
}
