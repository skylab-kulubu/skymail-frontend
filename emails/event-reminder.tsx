import * as React from "react";
import { Img, Text } from "@react-email/components";
import { Cta, DetailRow, Heading, Paragraph, Shell, Strong, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.reminder",
  name: "Etkinlik · Hatırlatma",
  subject: `Yarın: ${v("EventName")}`,
  system: false,
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
    <Shell preview={`${v("EventName")} yarın başlıyor.`} brand="skylab">
      <Heading>Yarın Görüşüyoruz</Heading>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> yarın başlıyor. Biletin hazır; kapıda QR kodunu okutman yeterli.
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Başlangıç" value={v("StartsAt")} />
        <DetailRow label="Yer" value={v("Venue")} last />
      </div>

      {ifSet("TicketQrUrl")}
      <div style={{ marginTop: "28px", textAlign: "center" }}>
        <Img
          src={v("TicketQrUrl")}
          width="160"
          height="160"
          alt="Bilet QR kodu"
          style={{ margin: "0 auto", borderRadius: "12px", backgroundColor: "#ffffff", padding: "12px" }}
        />
      </div>
      {end}

      {ifSet("MapUrl")}
      <Cta href={v("MapUrl")}>Yol Tarifi</Cta>
      {end}

      <Text
        className="t-faint"
        style={{ marginTop: "24px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Gelemeyeceksen haber vermen yeter — yerini bekleyen birine açarız.
      </Text>
    </Shell>
  );
}
