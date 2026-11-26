import * as React from "react";
import { Context, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, TextLink, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.waitlist-joined",
  name: "Etkinlik · Bekleme Listesi",
  subject: `${v("EventName")}: bekleme listesindesin`,
  system: false,
  // The Ticket page's link is a bearer key.
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, kontenjanı dolu bir etkinliğe yapılan kayıt bekleme listesine yazılınca kişiye (TICKET_STATUS_MAIL=on; docs/ticket-status-mail.md, ticket_mails kuyruğu, tür waitlisted): uygulamadan, herkese açık kayıttan ya da kabul edilen Forms cevabından. Yer açılınca sıradaki kişi kendiliğinden bilet alır ve event.waitlist-promoted gider. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), misafire yalnız bu e-posta (POST /v1/mail_tasks/single). TICKET_PAGE_URL açıkken core TicketUrl'yi (bilet sayfası, listeden çıkma orada) gönderir; kapalıyken boş gelir ve bağlantı görünmez. EventId yalnız kutu bağlantısı içindir.",
  // core-backend kontenjan-iptal-hatirlatma 04/06: the event's rows as
  // event.ticket-created has them, and the waiting Ticket's page.
  variables: ["EventId", "EventName", "EventDate", "Venue", "OwnerTeam", "TicketUrl", "Theme", "EventBannerUrl"],
  sensitiveVariables: ["TicketUrl"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    inbox: {
      title: `${v("EventName")}: bekleme listesindesin`,
      summary: "Yer açılırsa biletin kendiliğinden oluşur.",
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    EventDate: "12.04.2026 10:00",
    Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
    OwnerTeam: "WEBLAB",
    TicketUrl: "https://yildizskylab.com/bilet/7Q2MK4XRWZ3HN5TJVB6PDYCGEA",
    // The club's own look; "artlab" previews the ARTLAB theme.
    Theme: "",
    EventBannerUrl: "",
  },
};

/** Yusuf, 2026-11-24: a freed place goes to the next person on the list by itself, with a mail. */
export default function EventWaitlistJoined() {
  return (
    <Shell preview={`${v("EventName")}: bekleme listesindesin.`} brand="skylab" reason={null} themed>
      <Context tone="wait">{v("EventName")}</Context>
      <Title>Bekleme Listesindesin</Title>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> kontenjanı dolu. Yer açılır ve sıra sana gelirse biletin kendiliğinden oluşur, postayla haber veririz.
      </Paragraph>

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
        <RowsEnd />
      </Rows>

      {ifSet("TicketUrl")}
      <Paragraph style={{ margin: "16px 0 0", textAlign: "center" }}>
        <TextLink href={v("TicketUrl")}>Listeden çık</TextLink>
      </Paragraph>
      {end}
    </Shell>
  );
}
