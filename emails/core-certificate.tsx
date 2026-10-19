import * as React from "react";
import { Context, Cta, LinkFallback, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.certificate",
  name: "Katılım Sertifikası",
  subject: "Katılım sertifikan hazır",
  system: true,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, yoklama kesinleştikten sonra sertifika üretildiğinde (SKYMAIL_CERTIFICATE_TEMPLATE_ID, certificate/service.go).",
  // core-backend/internal/certificate/service.go:161 gönderdiği set.
  variables: ["FirstName", "EventName", "VerifyURL", "Serial", "OwnerTeam"],
  // The only way to the certificate page and its check; core always passes it.
  requiredVariables: [{ name: "VerifyURL", reason: "Sertifika sayfasının ve doğrulamasının adresi; kaldırılırsa katılımcı sertifikasına ulaşamaz." }],
  sample: {
    FirstName: "Yusuf",
    EventName: "GECEKODU 2026",
    VerifyURL: "https://skyl.app/dogrula/SKY-CERT-2026-0042",
    Serial: "SKY-CERT-2026-0042",
    OwnerTeam: "WEBLAB",
  },
};

/**
 * The certificate itself is a PDF that core stores; this mail carries the
 * verification link rather than an attachment, so the certificate stays
 * checkable by anyone the holder shows it to.
 */
export default function CoreCertificate() {
  const verifyUrl = v("VerifyURL");

  return (
    <Shell preview="Katılım sertifikan hazır." brand="skylab" reason={null}>
      <Context tone="ok">{v("EventName")}</Context>
      <Title>Sertifikan Hazır</Title>

      <Paragraph>
        Merhaba {v("FirstName")}, <Strong>{v("EventName")}</Strong> katılım sertifikan hazır.
      </Paragraph>

      <Rows>
        <RowItem label="Etkinlik">{v("EventName")}</RowItem>
        <RowItem label="Düzenleyen">{v("OwnerTeam")}</RowItem>
        <RowItem label="Sertifika No">{v("Serial")}</RowItem>
        <RowsEnd />
      </Rows>

      <Cta href={verifyUrl}>Sertifikamı Görüntüle</Cta>

      <LinkFallback href={verifyUrl} />
    </Shell>
  );
}
