import * as React from "react";
import { Context, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.event-co-organizer-removed",
  name: "Etkinlik · Ortak Düzenleyen Çıkarıldı",
  subject: `${v("EventName")}: ${ifSet("TeamName")}ekibin etkinlikten çıkarıldı${elseBranch}artık ortak düzenleyen değilsin${end}`,
  system: true,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, etkinliğin ortak düzenleyen listesinden bir ekip ya da kişi çıkarılınca (PUT /v1/events/{id}/organizers), 2 dakika sonra, çıkarma hâlâ duruyorsa (CO_ORGANIZER_MAIL=on; docs/co-organizers.md#mails, co_organizer_notifications kuyruğu). Kişiye ya da çıkarılan ekibin liderlerine (kendi LIDERLER/KOORDINATORLER grupları), bildirim olarak (POST /v1/notifications: kutu + e-posta). Her değişken her zaman gelir, boş olabilir: çıkarmada Management ve Visibility hep boştur, kişinin postasında TeamName de; ActorName adı artık gösterilemeyen biri değiştirdiyse boştur. PanelUrl gelir ama kullanılmaz: çıkarılan etkinliği panelde artık açamaz. Ekibe giden iç posta: etkinlik teması uygulanmaz.",
  // core-backend internal/coorganizermail vars (#464): the added mail's set;
  // a removal sends Management and Visibility empty.
  variables: ["EventId", "EventName", "OwnerTeam", "TeamName", "Management", "Visibility", "ActorName", "PanelUrl"],
  // The mail's one job is to name the event; core always passes it.
  requiredVariables: [{ name: "EventName", reason: "Hangi etkinlikten çıkarıldığını söyleyen tek alan; kaldırılırsa posta etkinliği adlandırmaz." }],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    // Every variable is always there (maybe empty).
    inbox: {
      title: `${v("EventName")}: ${ifSet("TeamName")}ekibin etkinlikten çıkarıldı${elseBranch}artık ortak düzenleyen değilsin${end}`,
      summary: `${ifSet("TeamName")}Ekip: ${v("TeamName")}${elseBranch}Düzenleyen: ${v("OwnerTeam")}${end}`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    OwnerTeam: "SKY LAB: Bilgisayar Bilimleri Kulübü",
    TeamName: "WEBLAB · Web Geliştirme",
    Management: "",
    Visibility: "",
    ActorName: "Ada Lovelace",
    PanelUrl: "https://admin.yildizskylab.com/events/6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
  },
};

/** A team's Leaders, or the person, learn they no longer manage the event. No button: the panel no longer opens it for them. */
export default function CoreEventCoOrganizerRemoved() {
  return (
    <Shell preview={`${v("EventName")}: ortak düzenleyen çıkarıldı.`} brand="skylab" reason={null}>
      <Context tone="neutral">{v("EventName")}</Context>
      <Title>
        {ifSet("TeamName")}Ekibin Etkinlikten Çıkarıldı{elseBranch}Ortak Düzenleyenlerden Çıkarıldın{end}
      </Title>

      <Paragraph>
        {ifSet("TeamName")}
        <Strong>{v("TeamName")}</Strong> ekibi <Strong>{v("EventName")}</Strong> etkinliğinin düzenleyenlerinden çıkarıldı.
        {elseBranch}
        <Strong>{v("EventName")}</Strong> etkinliğinin ortak düzenleyenlerinden çıkarıldın.
        {end}
      </Paragraph>

      <Rows>
        {ifSet("OwnerTeam")}
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        {end}
        {ifSet("ActorName")}
        <RowItem label="Çıkaran">{v("ActorName")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>
    </Shell>
  );
}
