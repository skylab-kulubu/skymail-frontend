import * as React from "react";
import { Img } from "@react-email/components";
import { Context, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, TextLink, TicketNote, Title } from "./theme";
import { end, ifNotSet, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.waitlist-promoted",
  name: "Etkinlik · Bekleme Listesinden Bilet",
  subject: `Yer açıldı: ${v("EventName")} biletin hazır`,
  system: false,
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, yer açılıp bekleme listesindeki bilet kendiliğinden etkinleşince ya da düzenleyen \"Öne al\" deyince kişiye (TICKET_STATUS_MAIL=on; docs/ticket-status-mail.md, ticket_mails kuyruğu, tür promoted). event.ticket-created ayrıca gitmez. Değişkenler event.ticket-created'ınkiler: TICKET_PAGE_URL açıkken TicketUrl, TicketQrUrl (PUBLIC_API_ORIGIN boşsa boş) ve TicketCode da gelir; kapalıyken boş gelir ve satırları görünmez. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), misafire yalnız bu e-posta (POST /v1/mail_tasks/single). EventId yalnız kutu bağlantısı içindir. TicketNote ve TicketNoteParts düzenleyenin bilet duyurusudur (ör. WhatsApp grubu; core docs/ticket-note.md), boşsa bölüm görünmez.",
  // core-backend kontenjan-iptal-hatirlatma 04/07: event.ticket-created's
  // variables (EventUrl aside, which core never sends).
  variables: ["EventId", "EventName", "EventDate", "Venue", "TicketQrUrl", "TicketCode", "TicketUrl", "OwnerTeam", "TicketNote", "TicketNoteParts", "Theme", "EventBannerUrl"],
  sensitiveVariables: ["TicketCode", "TicketQrUrl", "TicketUrl"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    inbox: {
      title: `Yer açıldı: ${v("EventName")} biletin hazır`,
      summary: `${ifSet("EventDate")}${v("EventDate")} · ${end}${v("Venue")}`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    EventDate: "12.04.2026 10:00",
    Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
    TicketQrUrl: "https://api.yildizskylab.com/v1/public/tickets/7Q2MK4XRWZ3HN5TJVB6PDYCGEA/qr.png",
    TicketCode: "K7M2-QX9F",
    TicketUrl: "https://yildizskylab.com/bilet/7Q2MK4XRWZ3HN5TJVB6PDYCGEA",
    OwnerTeam: "WEBLAB",
    // The organizer's announcement, a WhatsApp group (core cuts it at its https addresses).
    TicketNote: "Etkinlik duyuruları WhatsApp grubunda: https://chat.whatsapp.com/OrnekDavet123",
    TicketNoteParts: [
      { Text: "Etkinlik duyuruları WhatsApp grubunda: ", Url: "" },
      { Text: "https://chat.whatsapp.com/OrnekDavet123", Url: "https://chat.whatsapp.com/OrnekDavet123" },
    ],
    // The club's own look; "artlab" previews the ARTLAB theme.
    Theme: "",
    EventBannerUrl: "",
  },
};

/**
 * event.ticket-created's Ticket (QR on a white ground, the code, a plain link
 * to the page), opened by the one sentence that says where it came from, and
 * closed by the way out: the cancel button is on the Ticket page.
 */
export default function EventWaitlistPromoted() {
  return (
    <Shell preview={`Yer açıldı: ${v("EventName")} biletin hazır.`} brand="skylab" reason={null} themed>
      <Context tone="ok">{v("EventName")}</Context>
      <Title>Biletin Hazır</Title>

      <Paragraph>Yer açıldı, bekleme listesinde sıra sana geldi.</Paragraph>

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

      <TicketNote />

      {/* KVKK aydınlatma §5.12: as in the registration mail, since this is where the Ticket is made. */}
      <Small style={{ marginTop: "24px" }}>Etkinlikte fotoğraf ve video çekilir, Kulübün kanallarında paylaşılabilir.</Small>

      {ifSet("TicketUrl")}
      <Small style={{ marginTop: "8px" }}>
        Gelemeyecek misin? <TextLink href={v("TicketUrl")}>Biletini iptal et</TextLink>
      </Small>
      {end}
    </Shell>
  );
}
