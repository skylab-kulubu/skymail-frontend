import * as React from "react";
import { Context, Cta, LinkFallback, Paragraph, Shell, Small, Strong, TextLink, Title } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, v } from "./go";
import type { TemplateMeta } from "./types";

/** The published Açık Rıza Metni; core's CONTACT_CONSENT_TEXT_URL is the same address. */
const CONSENT_TEXT_URL = "https://yildizskylab.com/acik-riza-metni.pdf";

export const meta: TemplateMeta = {
  key: "core.contact-consent-confirm",
  name: "İletişim İzni Onayı",
  // core always passes purpose (internal/consent/service.go sendConfirmation), so the subject may branch on it.
  subject:
    "{{if eq .purpose `event_invitations`}}SKY LAB duyuru iznini onayla{{else if eq .purpose `promotional`}}SKY LAB tanıtım e-postası iznini onayla{{else}}SKY LAB iznini onayla{{end}}",
  system: true,
  // The confirm and withdraw links act for the address without a sign-in.
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, girişsiz verilen bir iletişim izni (Guest apply, Forms, Place, Guessr) pending yazıldığında; aynı izin için günde en çok bir, toplam en çok üç posta (çift onay, ADR-0062, docs/contact-consents.md). CONTACT_CONSENT_KEY açıkken gider. Ad taşımaz.",
  // Exactly what core sends; purpose: event_invitations, promotional (recruitment_pool once it is taken).
  variables: ["confirmUrl", "withdrawUrl", "purpose"],
  sensitiveVariables: ["confirmUrl", "withdrawUrl"],
  requiredVariables: [{ name: "confirmUrl", reason: "İzni onaylama bağlantısı; kaldırılırsa izin onaylanamaz ve bekleyen kayıt 30 gün sonra silinir." }],
  sample: {
    confirmUrl: "https://api.yildizskylab.com/v1/consents/confirm?token=q8Zr2LkV0xNw4TfH6yPa1cHn3Ks7Qw9Ld2Vx5Mb8Rt0e",
    withdrawUrl: "https://api.yildizskylab.com/v1/consents/withdraw?token=Hn3Ks7Qw9Ld2Vx5Mb8Rt0eq8Zr2LkV0xNw4TfH6yPa1c",
    purpose: "event_invitations",
  },
};

/**
 * Whoever typed the address may have typed any name with it, so the mail
 * greets nobody. It must carry no sponsor or other commercial content
 * (ADR-0062). The withdraw link ends the pending grant, so its mails stop;
 * it closes its sentence with no full stop, so the plain-text URL is not
 * followed by one.
 */
export default function CoreContactConsentConfirm() {
  const confirm = v("confirmUrl");
  return (
    <Shell preview="Bu adres için verilen izni onayla." brand="skylab" reason={null}>
      <Context tone="wait">İzin onayı</Context>
      <Title>İznini Onayla</Title>

      <Paragraph>
        {ifEq("purpose", "event_invitations")}Bu adrese <Strong>diğer SKY LAB etkinlikleri ve duyurularıyla ilgili e-postalar</Strong> gönderilmesi
        için izin verildi.{elseIfEq("purpose", "promotional")}Bu adrese{" "}
        <Strong>tanıtım içerikli SKY LAB e-postaları (indirim kodu, şirket iş ilanı, çekiliş gibi)</Strong> gönderilmesi için izin verildi.
        {elseBranch}Bu adres için SKY LAB&apos;e bir iletişim izni verildi.{end} Onaylayana kadar bu e-postalar gönderilmez.
      </Paragraph>

      <Cta href={confirm}>İznimi Onayla</Cta>

      <Small>Bu bağlantı 30 gün geçerli.</Small>

      <LinkFallback href={confirm} />

      <Small style={{ marginTop: "24px" }}>
        Ayrıntılar: <TextLink href={CONSENT_TEXT_URL}>Açık Rıza Metni</TextLink>
      </Small>

      <Small>
        Bu isteği sen yapmadıysan bu e-postayı yok say ya da <TextLink href={v("withdrawUrl")}>izni geri al</TextLink>
      </Small>
    </Shell>
  );
}
