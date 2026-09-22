import * as React from "react";
import { Text } from "@react-email/components";
import { Cta, DetailRow, Heading, LinkFallback, Paragraph, Shell, Strong, colors, fontStack } from "./theme";
import { v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.certificate",
  name: "Katılım Sertifikası",
  subject: "Katılım sertifikan hazır",
  system: true,
  brand: "skylab",
  trigger:
    "core-backend, yoklama kesinleştikten sonra sertifika üretildiğinde (SKYMAIL_CERTIFICATE_TEMPLATE_ID, certificate/service.go).",
  // core-backend/internal/certificate/service.go:161 gönderdiği set.
  variables: ["FirstName", "EventName", "VerifyURL", "Serial", "OwnerTeam"],
  // The only way to the certificate page and its check; core always passes it.
  requiredVariables: ["VerifyURL"],
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
    <Shell preview="Katılım sertifikan hazır — doğrulama bağlantısı içinde." brand="skylab">
      <Heading>Sertifikan Hazır</Heading>

      <Paragraph>
        Merhaba {v("FirstName")}, <Strong>{v("EventName")}</Strong> etkinliğine katılımın kayda geçti ve katılım
        sertifikan oluşturuldu. Aşağıdaki bağlantı sertifikanı hem görüntüler hem de doğrular.
      </Paragraph>

      <div style={{ marginTop: "28px" }}>
        <DetailRow label="Etkinlik" value={v("EventName")} />
        <DetailRow label="Düzenleyen" value={v("OwnerTeam")} />
        <DetailRow label="Sertifika No" value={v("Serial")} last />
      </div>

      <Cta href={verifyUrl}>Sertifikamı Görüntüle</Cta>

      <LinkFallback href={verifyUrl} />

      <Text
        className="t-faint"
        style={{ marginTop: "24px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Bu bağlantıyı paylaştığın herkes sertifikanın gerçekliğini kendisi doğrulayabilir; sertifikanın geçerliliği
        için ayrıca bir belge göndermene gerek yok.
      </Text>
    </Shell>
  );
}
