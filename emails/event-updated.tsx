import * as React from "react";
import { Cta, DetailRow, Heading, Note, Paragraph, Shell, Strong } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.updated",
  name: "Etkinlik · Güncellendi",
  subject: `${v("EventName")} etkinliğinde değişiklik var`,
  system: false,
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
    <Shell preview={`${v("EventName")} etkinliğinde bir değişiklik var.`} brand="skylab">
      <Heading>Etkinlikte Değişiklik Var</Heading>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> etkinliğinde bir değişiklik oldu. Biletin geçerli; sadece aşağıdaki bilgiler güncellendi.
      </Paragraph>

      {ifSet("ChangeSummary")}
      <div style={{ marginTop: "20px" }}>
        <Note>{v("ChangeSummary")}</Note>
      </div>
      {end}

      <div style={{ marginTop: "24px" }}>
        {ifSet("NewStartsAt")}
        <DetailRow label="Yeni başlangıç" value={v("NewStartsAt")} />
        {end}
        {ifSet("NewVenue")}
        <DetailRow label="Yeni yer" value={v("NewVenue")} last />
        {end}
      </div>

      {ifSet("EventUrl")}
      <Cta href={v("EventUrl")}>Güncel Bilgileri Gör</Cta>
      {end}
    </Shell>
  );
}
