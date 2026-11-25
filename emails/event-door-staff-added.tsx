import * as React from "react";
import { Context, Cta, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.door-staff-added",
  name: "Etkinlik · Kapı Görevlisi",
  subject: `${v("EventName")} etkinliğinde kapı görevlisisin`,
  system: false,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, bir üye etkinliğin kapı görevlisi listesine yeni eklenince (oluşturma, düzenleme ya da kopyada görevlilerle birlikte), eklendikten 2 dakika sonra, görevliye bir kez (DOOR_STAFF_MAIL=on; docs/door-staff-mail.md, door_staff_notifications kuyruğu). Listede zaten olana yeniden gitmez; çıkarılıp yeniden eklenene yeniden gider. Taslak etkinlikte yayına alınana kadar bekler; kişi listeden çıkarılırsa, etkinlik iptal edilir, biterse ya da 30 gün geçerse gitmez. Düzenleyene sorulmaz. Yalnız üyeye, bildirim olarak (POST /v1/notifications: kutu + e-posta). Her değişken her zaman gelir, boş olabilir. DoorUrl panelin kapı sayfasıdır (PANEL_URL + /events/{id}/door, üretimde https://admin.yildizskylab.com); PANEL_URL yoksa boş gelir ve düğme görünmez. EventId yalnız kutu bağlantısı içindir.",
  // core-backend internal/doorstaffmail vars (#442).
  variables: ["FirstName", "EventId", "EventName", "StartsAt", "EndsAt", "Venue", "DoorUrl"],
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    // Every variable is always there (maybe empty): the summary leaves out
    // the separator when either side is empty.
    inbox: {
      title: `${v("EventName")} etkinliğinde kapı görevlisisin`,
      summary: `${ifSet("StartsAt")}${v("StartsAt")}${ifSet("Venue")} · ${end}${end}${v("Venue")}`,
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    FirstName: "Ayşe",
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    EventName: "GECEKODU 2026",
    StartsAt: "12.04.2026 10:00",
    EndsAt: "12.04.2026 18:00",
    Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
    DoorUrl: "https://admin.yildizskylab.com/events/6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19/door",
  },
};

/** The person learns their own duty; the organizer is not asked. */
export default function EventDoorStaffAdded() {
  return (
    <Shell preview={`${v("EventName")} etkinliğinde kapı görevlisisin.`} brand="skylab" reason={null}>
      <Context>{v("EventName")}</Context>
      <Title>Kapı Görevlisisin</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        <Strong>{v("EventName")}</Strong> etkinliğine kapı görevlisi olarak eklendin. Biletleri panelin kapı sayfasından okutursun.
      </Paragraph>

      <Rows>
        {ifSet("StartsAt")}
        <RowItem label="Başlangıç">{v("StartsAt")}</RowItem>
        {end}
        {ifSet("EndsAt")}
        <RowItem label="Bitiş">{v("EndsAt")}</RowItem>
        {end}
        {ifSet("Venue")}
        <RowItem label="Yer">{v("Venue")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>

      {ifSet("DoorUrl")}
      <Cta href={v("DoorUrl")}>Kapı Sayfasını Aç</Cta>
      {end}
    </Shell>
  );
}
