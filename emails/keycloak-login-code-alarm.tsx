import * as React from "react";
import { Context, Paragraph, Shell, Small, Title } from "./theme";
import { elseBranch, end, ifEq, v } from "./go";
import type { TemplateMeta } from "./types";

const FULL = "skyLoginCodeAlarmFullSubject";

export const meta: TemplateMeta = {
  key: "keycloak.login-code-alarm",
  name: "Keycloak · E-posta Kodu Sınır Alarmı",
  // Keycloak tells half from full by subjectKey, which it always passes.
  subject: `{{if eq .subjectKey \`${FULL}\`}}SKY LAB: e-posta kodu gönderimi günlük sınıra ulaştı{{else}}SKY LAB: e-posta kodu gönderimi günlük sınırın yarısında{{end}}`,
  system: true,
  contentSensitive: false,
  brand: "account",
  trigger:
    "Keycloak, realm'in gün içinde (UTC) gönderdiği e-posta kodları günlük genel sınırın yarısına ve sonuna ulaştığında, günde birer kez, operatör adresine (SKY_EMAIL_CODE_ALARM_EMAIL; eskylab-login-ux 08). Kişi, adres ya da IP taşımaz. SkyMail'e ulaşılamazsa Keycloak aynı uyarıyı düz metinle SMTP'den yollar.",
  variables: ["realmDisplayName", "subjectKey"],
  requiredVariables: [],
  sample: {
    realmDisplayName: "SKY LAB",
    subjectKey: "skyLoginCodeAlarmHalfSubject",
  },
};

export default function KeycloakLoginCodeAlarm() {
  return (
    <Shell
      preview="E-posta kodu gönderimi günlük sınıra yaklaştı."
      brand="account"
      reason="Bu e-postayı, Keycloak'ın e-posta kodu alarmının alıcısı olduğun için alıyorsun."
    >
      <Context tone="bad">Operasyon uyarısı</Context>
      <Title>
        {ifEq("subjectKey", FULL)}E-posta Kodu Sınırı Doldu{elseBranch}E-posta Kodu Sınırının Yarısı{end}
      </Title>
      <Paragraph>
        Keycloak&apos;ın {v("realmDisplayName")} realm&apos;inde bugün (UTC günü) gönderilen e-posta kodları{" "}
        {ifEq("subjectKey", FULL)}günlük genel sınıra ulaştı.{elseBranch}günlük genel sınırın yarısına ulaştı.{end}{" "}
        Giriş kodları sınırdan sonra da gider; açıldığında kayıt kodları sınırda durur.
      </Paragraph>
      <Paragraph>
        Beklenmedik bir artışsa Keycloak olaylarına (LOGIN_ERROR, ayrıntı sky_email_code) ve SkyMail&apos;deki
        keycloak.login-code gönderimlerine bak.
      </Paragraph>
      <Small>Bu posta Keycloak&apos;ın e-postayla giriş adımından (sky-email-code) otomatik gelir.</Small>
    </Shell>
  );
}
