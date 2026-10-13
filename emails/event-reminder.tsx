import * as React from "react";
import { Img } from "@react-email/components";
import { Context, Cta, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.reminder",
  name: "Etkinlik · Hatırlatma",
  subject: `Yarın: ${v("EventName")}`,
  system: false,
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "Etkinlikten bir gün önce, bileti olan herkese. NOT: zamanlayıcı ve gönderim kodu henüz yazılmadı; konu satırı T-1 varsayıyor.",
  variables: ["EventName", "StartsAt", "Venue", "TicketQrUrl", "MapUrl"],
  sample: {
    EventName: "GECEKODU 2026",
    StartsAt: "12 Nisan 2026, 10:00",
    Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
    TicketQrUrl: "https://skyl.app/qr/SKY-TCK-2026-0042.png",
    MapUrl: "https://maps.app.goo.gl/ornek",
  },
};

export default function EventReminder() {
  return (
    <Shell
      preview={`${v("EventName")} yarın başlıyor.`}
      brand="skylab"
      reason={<>Bu e-postayı {v("EventName")} etkinliğine kayıtlı olduğun için alıyorsun.</>}
    >
      <Context tone="wait">{v("EventName")}</Context>
      <Title>Yarın Görüşüyoruz</Title>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> yarın başlıyor. Biletin hazır; kapıda QR kodunu okutman yeterli.
      </Paragraph>

      <Rows>
        <RowItem label="Başlangıç">{v("StartsAt")}</RowItem>
        <RowItem label="Yer">{v("Venue")}</RowItem>
        <RowsEnd />
      </Rows>

      {ifSet("TicketQrUrl")}
      <div style={{ marginTop: "28px", textAlign: "center" }}>
        <Img
          src={v("TicketQrUrl")}
          width="160"
          height="160"
          alt="Bilet QR kodu"
          style={{ margin: "0 auto", borderRadius: "8px", backgroundColor: "#ffffff", padding: "12px", border: "1px solid #e5e5e5" }}
        />
      </div>
      {end}

      {ifSet("MapUrl")}
      <Cta href={v("MapUrl")}>Yol Tarifi</Cta>
      {end}

      <Small style={{ marginTop: "24px" }}>Gelemeyeceksen haber vermen yeter — yerini bekleyen birine açarız.</Small>
    </Shell>
  );
}
