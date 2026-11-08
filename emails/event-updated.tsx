import * as React from "react";
import { Context, Cta, Note, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.updated",
  name: "Etkinlik · Güncellendi",
  subject: `${v("EventName")} etkinliğinde değişiklik var`,
  system: false,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, yayındaki ve bitmemiş bir etkinliğin başlangıcı, bitişi ya da yeri değişince, ilk değişiklikten 15 dakika sonra (aradaki değişiklikler tek bildirimde), bileti olan herkese (EVENT_UPDATED_NOTIFICATION=on; docs/event-updated-notification.md). Üyeye bildirim olarak (POST /v1/notifications: kutu + e-posta), konuğa yalnız bu e-posta. Değerler gönderim anındaki etkinliktir; core bugün EventUrl göndermez, düğme boşsa görünmez.",
  variables: ["EventName", "ChangeSummary", "NewStartsAt", "NewEndsAt", "NewVenue", "EventUrl"],
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
    EventUrl: "https://skyl.app/gecekodu",
  },
};

/** The Event as it is now: every row is today's value, ChangeSummary says which one moved. */
export default function EventUpdated() {
  return (
    <Shell preview={`${v("EventName")} etkinliğinde değişiklik var.`} brand="skylab" reason={null}>
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
        <RowsEnd />
      </Rows>

      {ifSet("EventUrl")}
      <Cta href={v("EventUrl")}>Güncel Bilgileri Gör</Cta>
      {end}
    </Shell>
  );
}
