import * as React from "react";
import { Context, Cta, LinkFallback, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.certificate-auto-finalized",
  name: "Katılım Kendiliğinden Kapandı",
  subject: `${v("EventName")}: katılım kapandı`,
  system: true,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, son canlı oturumun bitişinden 1 saat sonra katılım kendiliğinden kapanınca, etkinliği yayınlayan kişiye bir kez (SKYMAIL_CERTIFICATE_AUTO_FINALIZED_TEMPLATE_KEY, internal/certificate/auto_finalize.go; boş anahtar postayı kapatır). Elle kapatmada gitmez.",
  // core-backend/internal/certificate/auto_finalize.go mailAutoFinalized gönderdiği set.
  // CertificateCount: kapanışta sıraya alınan sertifika sayısı, "0" olabilir.
  variables: ["FirstName", "EventName", "EventId", "CertificateCount", "OwnerTeam"],
  requiredVariables: [
    { name: "EventId", reason: "Paneldeki Sertifikalar sekmesinin adresi; kaldırılırsa düzenleyen etkinliğe ulaşamaz." },
  ],
  sample: {
    FirstName: "Yusuf",
    EventName: "ARTLAB Yapay Zeka Zirvesi",
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
    CertificateCount: "42",
    OwnerTeam: "ARTLAB",
  },
};

/**
 * Goes to the person who published the Event, not to attendees: they get
 * their own core.certificate mail as each certificate is ready.
 */
export default function CoreCertificateAutoFinalized() {
  const panelUrl = `https://admin.yildizskylab.com/events/${v("EventId")}/certificates`;

  return (
    <Shell preview={`${v("EventName")}: katılım kapandı.`} brand="skylab" reason={null}>
      <Context tone="ok">Sertifikalar</Context>
      <Title>Katılım Kapandı</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        <Strong>{v("EventName")}</Strong> etkinliğinde katılım, son oturumdan bir saat sonra kendiliğinden kapandı.
      </Paragraph>

      <Paragraph>
        {ifEq("CertificateCount", "0")}Sıraya alınan sertifika yok.{elseBranch}
        <Strong>{v("CertificateCount")}</Strong> kişinin sertifikası sıraya alındı. Her biri hazır olunca kişiye postayla gider.
        {end}
      </Paragraph>

      <Rows>
        <RowItem label="Etkinlik">{v("EventName")}</RowItem>
        {ifSet("OwnerTeam")}
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        {end}
        <RowItem label="Sıraya alınan">{v("CertificateCount")}</RowItem>
        <RowsEnd />
      </Rows>

      <Paragraph>Kapanıştan sonra düzelttiğin yoklamalar için Sertifikalar sekmesinde &quot;Uygunları yeniden tara&quot;yı kullan.</Paragraph>

      <Cta href={panelUrl}>Sertifikalar Sekmesini Aç</Cta>

      <LinkFallback href={panelUrl} />
    </Shell>
  );
}
