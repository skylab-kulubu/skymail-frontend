import * as React from "react";
import { Context, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.ticket-cancelled",
  name: "Etkinlik · Bilet İptal Edildi",
  subject: `${v("EventName")} biletin iptal edildi`,
  system: false,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, bir bilet iptal edilince bilet sahibine (TICKET_STATUS_MAIL=on; docs/ticket-status-mail.md, ticket_mails kuyruğu, tür cancelled): kişi kendi biletini iptal edince (CancelledBy=holder) ya da düzenleyen panelden \"kişiye bildir\" seçerek iptal edince (CancelledBy=operator, Reason düzenleyenin gerekçesi, boş olabilir). Forms reddi göndermez. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), misafire yalnız bu e-posta (POST /v1/mail_tasks/single). EventId yalnız kutu bağlantısı içindir.",
  // core-backend kontenjan-iptal-hatirlatma 04: EventId, EventName, EventDate
  // (empty without a start), OwnerTeam, CancelledBy (holder | operator) and
  // Reason (empty unless the organizer wrote one), always all of them.
  variables: ["EventId", "EventName", "EventDate", "OwnerTeam", "CancelledBy", "Reason"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    inbox: {
      title: `${v("EventName")} biletin iptal edildi`,
      summary: `${ifEq("CancelledBy", "operator")}Düzenleyen iptal etti.${elseBranch}İptal ettin.${end}`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    EventDate: "12.04.2026 10:00",
    OwnerTeam: "WEBLAB",
    CancelledBy: "operator",
    Reason: "Aynı kişiye iki bilet yazılmış.",
  },
};

/** Who cancelled, the event's rows and the organizer's reason when there is one. No way back in: there is no event page to register again from. */
export default function EventTicketCancelled() {
  return (
    <Shell preview={`${v("EventName")} biletin iptal edildi.`} brand="skylab" reason={null}>
      <Context tone="bad">{v("EventName")}</Context>
      <Title>Biletin İptal Edildi</Title>

      <Paragraph>
        {ifEq("CancelledBy", "operator")}Düzenleyen, <Strong>{v("EventName")}</Strong> biletini iptal etti.{elseBranch}
        <Strong>{v("EventName")}</Strong> biletini iptal ettin.{end}
      </Paragraph>

      <Rows>
        <RowItem label="Etkinlik">{v("EventName")}</RowItem>
        {ifSet("EventDate")}
        <RowItem label="Tarih">{v("EventDate")}</RowItem>
        {end}
        {ifSet("OwnerTeam")}
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        {end}
        {ifSet("Reason")}
        <RowItem label="Gerekçe">{v("Reason")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>
    </Shell>
  );
}
