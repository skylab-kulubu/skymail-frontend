import * as React from "react";
import { Context, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.registration-full",
  name: "Etkinlik · Kontenjan Doldu",
  subject: `${v("EventName")} kontenjanı doldu`,
  system: false,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, kabul edilen bir Forms cevabı kontenjanı dolu ve bekleme listesi kapalı bir etkinliğe gelince kişiye (TICKET_STATUS_MAIL=on; docs/ticket-status-mail.md, ticket_mails kuyruğu, tür full; core Forms'a 200 {\"outcome\":\"event_full\"} döner). Bilet yazılmaz. Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), misafire yalnız bu e-posta (POST /v1/mail_tasks/single). EventId yalnız kutu bağlantısı içindir.",
  // core-backend kontenjan-iptal-hatirlatma 04/06: no Ticket exists, so the
  // event's rows alone.
  variables: ["EventId", "EventName", "EventDate", "OwnerTeam"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    inbox: {
      title: `${v("EventName")} kontenjanı doldu`,
      summary: "Başvurundan bilet oluşmadı.",
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    EventDate: "12.04.2026 10:00",
    OwnerTeam: "WEBLAB",
  },
};

export default function EventRegistrationFull() {
  return (
    <Shell preview={`${v("EventName")} kontenjanı doldu.`} brand="skylab" reason={null}>
      <Context tone="bad">{v("EventName")}</Context>
      <Title>Kontenjan Doldu</Title>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> kontenjanı dolu olduğu için başvurundan bilet oluşmadı.
      </Paragraph>

      <Rows>
        <RowItem label="Etkinlik">{v("EventName")}</RowItem>
        {ifSet("EventDate")}
        <RowItem label="Tarih">{v("EventDate")}</RowItem>
        {end}
        {ifSet("OwnerTeam")}
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>
    </Shell>
  );
}
