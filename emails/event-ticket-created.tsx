import * as React from "react";
import { Img, Text } from "@react-email/components";
import { Cta, DetailRow, Heading, Label, Paragraph, Shell, Strong, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.ticket-created",
  name: "Etkinlik · Bilet Oluşturuldu",
  subject: `${v("EventName")} biletin hazır`,
  system: false,
  brand: "skylab",
  trigger:
    "core-backend, Member apply / Guest apply / Apply-for-other bir Ticket yazdığında. NOT: bu gönderimi yapan kod henüz yazılmadı.",
  variables: ["EventName", "EventDate", "Venue", "TicketQrUrl", "TicketCode", "OwnerTeam", "EventUrl"],
  sample: {
    EventName: "GECEKODU 2026",
    EventDate: "12–13 Nisan 2026, 10:00",
    Venue: "YTÜ Davutpaşa Kampüsü, D-Blok",
    TicketQrUrl: "https://skyl.app/qr/SKY-TCK-2026-0042.png",
    TicketCode: "SKY-TCK-2026-0042",
    OwnerTeam: "WEBLAB",
    EventUrl: "https://skyl.app/gecekodu",
  },
};

/**
 * The QR is the door proof, so the mail has to work when images are blocked:
 * the ticket code is printed as text under it, and the door can look that up.
 */
export default function EventTicketCreated() {
  return (
    <Shell preview={`${v("EventName")} için biletin hazır — kapıda bu QR okutulacak.`} brand="skylab">
      <Heading>Biletin Hazır</Heading>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> için kaydın alındı. Kapıda aşağıdaki QR kodu okutman yeterli.
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Etkinlik" value={v("EventName")} />
        {ifSet("EventDate")}
        <DetailRow label="Tarih" value={v("EventDate")} />
        {end}
        {ifSet("Venue")}
        <DetailRow label="Yer" value={v("Venue")} />
        {end}
        {ifSet("OwnerTeam")}
        <DetailRow label="Düzenleyen" value={v("OwnerTeam")} last />
        {end}
      </div>

      {ifSet("TicketQrUrl")}
      <div style={{ marginTop: "28px", textAlign: "center" }}>
        <Img
          src={v("TicketQrUrl")}
          width="180"
          height="180"
          alt="Bilet QR kodu"
          style={{ margin: "0 auto", borderRadius: "12px", backgroundColor: "#ffffff", padding: "12px" }}
        />
      </div>
      {end}

      {ifSet("TicketCode")}
      <div style={{ marginTop: "16px", textAlign: "center" }}>
        <Label>Bilet Kodu</Label>
        <Text
          className="t-primary"
          style={{
            margin: "6px 0 0",
            textAlign: "center",
            fontSize: "16px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: colors.textPrimary,
            fontFamily: "'SF Mono', Menlo, Consolas, monospace",
          }}
        >
          {v("TicketCode")}
        </Text>
      </div>
      {end}

      {ifSet("EventUrl")}
      <Cta href={v("EventUrl")}>Etkinlik Sayfası</Cta>
      {end}

      <Text
        className="t-faint"
        style={{ marginTop: "24px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Görseller görünmüyorsa bilet kodunu kapıdaki görevliye söylemen yeterli. Bu bilet sana ait; başkasına devredilemez.
      </Text>
    </Shell>
  );
}
