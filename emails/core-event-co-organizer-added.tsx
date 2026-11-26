import * as React from "react";
import { Context, Cta, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.event-co-organizer-added",
  name: "Etkinlik · Ortak Düzenleyen Eklendi",
  subject: `${v("EventName")}: ${ifSet("TeamName")}ekibin etkinliğe eklendi${elseBranch}ortak düzenleyen oldun${end}`,
  system: true,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, etkinliğin ortak düzenleyen listesine bir ekip ya da kişi eklenince (PUT /v1/events/{id}/organizers), 2 dakika sonra, ekleme hâlâ duruyorsa (CO_ORGANIZER_MAIL=on; docs/co-organizers.md#mails, co_organizer_notifications kuyruğu). Kişiye ya da eklenen ekibin liderlerine (kendi LIDERLER/KOORDINATORLER grupları), bildirim olarak (POST /v1/notifications: kutu + e-posta). Yalnız seçimleri değişen ekibe ve kopyaya gitmez. Her değişken her zaman gelir, boş olabilir: kişinin postasında TeamName, Management ve Visibility boştur; ActorName adı artık gösterilemeyen biri değiştirdiyse boştur; PanelUrl PANEL_URL yoksa boştur ve düğme görünmez. Ekibe giden iç posta: etkinlik teması uygulanmaz.",
  // core-backend internal/coorganizermail vars (#464). Management: "yalnız
  // liderler" | "bütün üyeler"; Visibility: "ortak düzenleyen" | "yardımcı
  // ekip (dışarıda görünmez)"; PanelUrl: PANEL_URL + /events/{id}.
  variables: ["EventId", "EventName", "OwnerTeam", "TeamName", "Management", "Visibility", "ActorName", "PanelUrl"],
  // The mail's one job is to name the event; core always passes it.
  requiredVariables: [{ name: "EventName", reason: "Hangi etkinliğe eklendiğini söyleyen tek alan; kaldırılırsa posta etkinliği adlandırmaz." }],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    // Every variable is always there (maybe empty).
    inbox: {
      title: `${v("EventName")}: ${ifSet("TeamName")}ekibin etkinliğe eklendi${elseBranch}ortak düzenleyen oldun${end}`,
      summary: `${ifSet("TeamName")}Ekip: ${v("TeamName")}${elseBranch}Düzenleyen: ${v("OwnerTeam")}${end}`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    OwnerTeam: "SKY LAB: Bilgisayar Bilimleri Kulübü",
    TeamName: "WEBLAB · Web Geliştirme",
    Management: "yalnız liderler",
    Visibility: "ortak düzenleyen",
    ActorName: "Ada Lovelace",
    PanelUrl: "https://admin.yildizskylab.com/events/6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
  },
};

/** A team's Leaders, or the person, learn they now manage the event. */
export default function CoreEventCoOrganizerAdded() {
  return (
    <Shell preview={`${v("EventName")}: ortak düzenleyen eklendi.`} brand="skylab" reason={null}>
      <Context tone="ok">{v("EventName")}</Context>
      <Title>
        {ifSet("TeamName")}Ekibin Etkinliğe Eklendi{elseBranch}Ortak Düzenleyen Oldun{end}
      </Title>

      <Paragraph>
        {ifSet("TeamName")}
        <Strong>{v("TeamName")}</Strong> ekibi <Strong>{v("EventName")}</Strong> etkinliğinin düzenleyenlerine eklendi. Etkinliği panelden
        yönetebilirsiniz.
        {elseBranch}
        <Strong>{v("EventName")}</Strong> etkinliğine ortak düzenleyen olarak eklendin. Etkinliği panelden yönetebilirsin; yetkin etkinlik
        bittikten 30 gün sonra sona erer.
        {end}
      </Paragraph>

      <Rows>
        {ifSet("OwnerTeam")}
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        {end}
        {ifSet("Visibility")}
        <RowItem label="Ekibin rolü">{v("Visibility")}</RowItem>
        {end}
        {ifSet("Management")}
        <RowItem label="Ekipte yöneten">{v("Management")}</RowItem>
        {end}
        {ifSet("ActorName")}
        <RowItem label="Ekleyen">{v("ActorName")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>

      {ifSet("PanelUrl")}
      <Cta href={v("PanelUrl")}>Etkinliği Panelde Aç</Cta>
      {end}
    </Shell>
  );
}
