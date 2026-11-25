import * as React from "react";
import { Context, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, TextLink, Title } from "./theme";
import { elseBranch, end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.changed",
  name: "Etkinlik · Ayrıntılar Değişti",
  subject: `${v("EventName")} etkinliğinde değişiklik var`,
  system: false,
  // The Ticket's link is a bearer key: the content is masked, the rows stay readable.
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, yayındaki ve bitmemiş bir etkinliğin adı, açıklaması, katılımcı notu, kontenjanı ya da bağlantıları değişince ve düzenleyen kaydederken \"Bilet sahiplerine bildir\" kutusunu işaretleyince (varsayılan işaretsiz), ilk değişiklikten 15 dakika sonra (aradaki değişiklikler tek bildirimde; geri alınan alan söylenmez), bileti olan herkese (EVENT_CHANGED_NOTIFICATION=on; docs/event-updated-notification.md#other-details). Aynı pencerede saat ya da yer de değiştiyse bu değil event.updated gider. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), konuğa yalnız bu e-posta. Değişen alanın metni postaya girmez: ChangedFields hangi alanların değiştiğini (\"açıklaması ve bağlantıları\"), ChangeSummary aynısını cümle olarak söyler. StartsAt ve Venue gönderim anındaki etkinliktir. TICKET_PAGE_URL açıkken core alıcının biletinden TicketUrl ve TicketCode da gönderir; kapalıyken göndermez ve satırları görünmez. EventId yalnız kutu bağlantısı içindir.",
  // core-backend internal/eventupdatenotify changedVars + withTicket (#443).
  variables: ["EventId", "EventName", "ChangedFields", "ChangeSummary", "StartsAt", "Venue", "TicketCode", "TicketUrl"],
  sensitiveVariables: ["TicketCode", "TicketUrl"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    // core always sends EventId, EventName and ChangeSummary: the inbox text
    // reads only those.
    inbox: {
      title: `${v("EventName")} etkinliğinde değişiklik var`,
      summary: v("ChangeSummary"),
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    ChangedFields: "açıklaması ve bağlantıları",
    ChangeSummary: "Etkinliğin açıklaması ve bağlantıları değişti.",
    StartsAt: "12.04.2026 10:00",
    Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
    TicketCode: "K7M2-QX9F",
    TicketUrl: "https://yildizskylab.com/bilet/7Q2MK4XRWZ3HN5TJVB6PDYCGEA",
  },
};

/**
 * Which details moved, never their text (a description can be long; the
 * attendee note stays in the welcome mail). The Ticket page shows the Event
 * as it is now.
 */
export default function EventChanged() {
  return (
    <Shell preview={`${v("EventName")} etkinliğinde değişiklik var.`} brand="skylab" reason={null}>
      <Context tone="wait">{v("EventName")}</Context>
      <Title>Etkinlikte Değişiklik Var</Title>

      <Paragraph>
        {ifSet("ChangedFields")}
        <Strong>{v("EventName")}</Strong> etkinliğinin {v("ChangedFields")} değişti.
        {elseBranch}
        <Strong>{v("EventName")}</Strong> etkinliğinde değişiklik var.
        {end}{" "}
        Biletin geçerli.
      </Paragraph>

      <Rows>
        {ifSet("StartsAt")}
        <RowItem label="Başlangıç">{v("StartsAt")}</RowItem>
        {end}
        {ifSet("Venue")}
        <RowItem label="Yer">{v("Venue")}</RowItem>
        {end}
        {ifSet("TicketCode")}
        <RowItem label="Bilet kodu">{v("TicketCode")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>

      {ifSet("TicketUrl")}
      <Paragraph style={{ margin: "16px 0 0", textAlign: "center" }}>
        <TextLink href={v("TicketUrl")}>Güncel bilgileri gör</TextLink>
      </Paragraph>
      {end}
    </Shell>
  );
}
