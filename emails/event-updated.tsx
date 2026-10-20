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
    "Etkinliğin saati veya yeri değiştiğinde, bileti olan herkese. NOT: gönderim kodu henüz yazılmadı.",
  variables: ["EventName", "ChangeSummary", "NewStartsAt", "NewVenue", "EventUrl"],
  sample: {
    EventName: "GECEKODU 2026",
    ChangeSummary: "Etkinlik bir gün ileri alındı ve salon değişti.",
    NewStartsAt: "13 Nisan 2026, 10:00",
    NewVenue: "YTÜ Davutpaşa Kampüsü, Kongre Merkezi",
    EventUrl: "https://skyl.app/gecekodu",
  },
};

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
        <RowItem label="Yeni başlangıç">{v("NewStartsAt")}</RowItem>
        {end}
        {ifSet("NewVenue")}
        <RowItem label="Yeni yer">{v("NewVenue")}</RowItem>
        <RowsEnd />
        {end}
      </Rows>

      {ifSet("EventUrl")}
      <Cta href={v("EventUrl")}>Güncel Bilgileri Gör</Cta>
      {end}
    </Shell>
  );
}
