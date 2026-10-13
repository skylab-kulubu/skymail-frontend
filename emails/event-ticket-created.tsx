import * as React from "react";
import { Img } from "@react-email/components";
import { CodeBlock, Context, Cta, Label, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.ticket-created",
  name: "Etkinlik · Bilet Oluşturuldu",
  subject: `${v("EventName")} biletin hazır`,
  system: false,
  contentSensitive: true,
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
    <Shell
      preview={`${v("EventName")} için biletin hazır — kapıda bu QR okutulacak.`}
      brand="skylab"
      reason={<>Bu e-postayı {v("EventName")} etkinliğine kaydolduğun için alıyorsun.</>}
    >
      <Context tone="ok">{v("EventName")}</Context>
      <Title>Biletin Hazır</Title>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> için kaydın alındı. Kapıda aşağıdaki QR kodu okutman yeterli.
      </Paragraph>

      <Rows>
        <RowItem label="Etkinlik">{v("EventName")}</RowItem>
        {ifSet("EventDate")}
        <RowItem label="Tarih">{v("EventDate")}</RowItem>
        {end}
        {ifSet("Venue")}
        <RowItem label="Yer">{v("Venue")}</RowItem>
        {end}
        {ifSet("OwnerTeam")}
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>

      {/* The QR keeps a white ground of its own: a scanner needs the contrast in either theme. */}
      {ifSet("TicketQrUrl")}
      <div style={{ marginTop: "28px", textAlign: "center" }}>
        <Img
          src={v("TicketQrUrl")}
          width="180"
          height="180"
          alt="Bilet QR kodu"
          style={{ margin: "0 auto", borderRadius: "8px", backgroundColor: "#ffffff", padding: "12px", border: "1px solid #e5e5e5" }}
        />
      </div>
      {end}

      {ifSet("TicketCode")}
      <div style={{ marginTop: "16px" }}>
        <Label>Bilet Kodu</Label>
        <CodeBlock size={16} center>
          {v("TicketCode")}
        </CodeBlock>
      </div>
      {end}

      {ifSet("EventUrl")}
      <Cta href={v("EventUrl")}>Etkinlik Sayfası</Cta>
      {end}

      <Small style={{ marginTop: "24px" }}>
        Görseller görünmüyorsa bilet kodunu kapıdaki görevliye söylemen yeterli. Bu bilet sana ait; başkasına devredilemez.
      </Small>
    </Shell>
  );
}
