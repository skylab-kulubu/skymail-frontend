import * as React from "react";
import { Context, Paragraph, Shell, Small, Title } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, v } from "./go";
import type { TemplateMeta } from "./types";

const FULL = "skyLoginCodeAlarmFullSubject";
/** Security review K2: the first account of the day at its wrong-code ceiling. */
const CEILING = "skyLoginCodeAlarmCeilingSubject";

export const meta: TemplateMeta = {
  key: "keycloak.login-code-alarm",
  name: "Keycloak · E-posta Kodu Sınır Alarmı",
  // Keycloak tells half, full and the wrong-code ceiling apart by subjectKey, which it always passes.
  subject: `{{if eq .subjectKey \`${FULL}\`}}SKY LAB: e-posta kodu gönderimi günlük sınıra ulaştı{{else if eq .subjectKey \`${CEILING}\`}}SKY LAB: bir hesap e-posta kodunda günlük yanlış kod tavanına ulaştı{{else}}SKY LAB: e-posta kodu gönderimi günlük sınırın yarısında{{end}}`,
  system: true,
  contentSensitive: false,
  brand: "account",
  trigger:
    "Keycloak, realm'in gün içinde (UTC) gönderdiği e-posta kodları günlük genel sınırın yarısına ve sonuna ulaştığında ve günün ilk hesabı yanlış kod tavanına ulaştığında (güvenlik incelemesi K2), günde birer kez, /ADMIN grubunun her üyesine ayrı ayrı (SKY_EMAIL_CODE_ALARM_GROUP; eskylab-login-ux 08). Kod isteyen kişiyi, adresi ya da IP'yi taşımaz. SkyMail'e ulaşılamazsa Keycloak aynı uyarıyı sayılarla, düz metinle SMTP'den yollar.",
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
      preview="E-posta kodu girişinde bir sınıra ulaşıldı."
      brand="account"
      reason="Bu e-postayı, SKY LAB'in yönetici grubunda (ADMIN) olduğun ve Keycloak'ın e-posta kodu alarmı sana gittiği için alıyorsun."
    >
      <Context tone="bad">Operasyon uyarısı</Context>
      <Title>
        {ifEq("subjectKey", FULL)}E-posta Kodu Sınırı Doldu{elseIfEq("subjectKey", CEILING)}Yanlış Kod Tavanı
        {elseBranch}E-posta Kodu Sınırının Yarısı{end}
      </Title>
      {ifEq("subjectKey", CEILING)}
      <Paragraph>
        Keycloak&apos;ın {v("realmDisplayName")} realm&apos;inde bugün (UTC günü) bir hesap, e-posta kodunda günlük
        yanlış kod tavanına ulaştı (SKY_EMAIL_CODE_WRONG_CODES_PER_ACCOUNT, varsayılan 10). O hesaba gün bitene
        kadar yeni kod postalanmaz; kod isteyene ekran aynı görünür. Parola, passkey ve YTÜ girişi etkilenmez.
      </Paragraph>
      <Paragraph>
        Bu uyarı günde bir kez gelir. Gün içinde tavana ulaşan sonraki hesaplar Keycloak&apos;ın sunucu
        günlüğünde sayılır (sky_email_code_wrong_ceiling); kişiler Keycloak olaylarındadır (LOGIN_ERROR, ayrıntı
        sky_email_code=wrong_code ve wrong_code_ceiling).
      </Paragraph>
      {elseBranch}
      <Paragraph>
        Keycloak&apos;ın {v("realmDisplayName")} realm&apos;inde bugün (UTC günü) gönderilen e-posta kodları{" "}
        {ifEq("subjectKey", FULL)}günlük genel sınıra ulaştı.{elseBranch}günlük genel sınırın yarısına ulaştı.{end}{" "}
        Giriş kodları sınırdan sonra da gider; açıldığında kayıt kodları sınırda durur.
      </Paragraph>
      <Paragraph>
        Beklenmedik bir artışsa Keycloak olaylarına (LOGIN_ERROR, ayrıntı sky_email_code) ve SkyMail&apos;deki
        keycloak.login-code gönderimlerine bak.
      </Paragraph>
      {end}
      <Small>Bu posta Keycloak&apos;ın e-postayla giriş adımından (sky-email-code) otomatik gelir.</Small>
    </Shell>
  );
}
