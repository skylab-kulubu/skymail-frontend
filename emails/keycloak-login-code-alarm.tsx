import * as React from "react";
import { Context, Paragraph, Shell, Title } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, v } from "./go";
import type { TemplateMeta } from "./types";

const FULL = "skyLoginCodeAlarmFullSubject";
/** Security review K2: the first account of the day at its wrong-code ceiling. */
const CEILING = "skyLoginCodeAlarmCeilingSubject";
/** The persistent account counter, independent of the UTC day's budgets. */
const CONSECUTIVE = "skyLoginCodeAlarmConsecutiveSubject";

export const meta: TemplateMeta = {
  key: "keycloak.login-code-alarm",
  name: "Keycloak · E-posta Kodu Sınır Alarmı",
  // Keycloak tells the daily budgets and the persistent counter apart by subjectKey.
  subject: `{{if eq .subjectKey \`${FULL}\`}}SKY LAB: e-posta kodu gönderimi günlük sınıra ulaştı{{else if eq .subjectKey \`${CEILING}\`}}SKY LAB: bir hesap e-posta kodunda günlük yanlış kod tavanına ulaştı{{else if eq .subjectKey \`${CONSECUTIVE}\`}}SKY LAB: bir hesap ardışık 100 yanlış e-posta koduna ulaştı{{else}}SKY LAB: e-posta kodu gönderimi günlük sınırın yarısında{{end}}`,
  system: true,
  contentSensitive: false,
  brand: "account",
  trigger:
    "Keycloak, realm'in gün içinde (UTC) gönderdiği e-posta kodları günlük genel sınırın yarısına ve sonuna ulaştığında ve günün ilk hesabı yanlış kod tavanına ulaştığında (güvenlik incelemesi K2), günde birer kez, /ADMIN grubunun her üyesine ayrı ayrı (SKY_EMAIL_CODE_ALARM_GROUP; eskylab-login-ux 08). Ayrıca bir hesabın kalıcı ardışık yanlış e-posta kodu sayacı 99'dan 100'e yükseldiğinde, işlem commit olduktan sonra bir kez aynı gruba uyarı gider (eskylab-login-ux 24). Kod isteyen kişiyi, adresi ya da IP'yi taşımaz. SkyMail'e ulaşılamazsa Keycloak aynı uyarıyı sayılarla, düz metinle SMTP'den yollar.",
  variables: ["realmDisplayName", "subjectKey"],
  requiredVariables: [],
  sample: {
    realmDisplayName: "SKY LAB",
    subjectKey: "skyLoginCodeAlarmHalfSubject",
  },
};

export default function KeycloakLoginCodeAlarm() {
  return (
    <Shell preview="E-posta kodu girişinde bir sınıra ulaşıldı." brand="account" reason={null}>
      <Context tone="bad">Operasyon uyarısı</Context>
      <Title>
        {ifEq("subjectKey", FULL)}E-posta Kodu Sınırı Doldu{elseIfEq("subjectKey", CEILING)}Yanlış Kod Tavanı
        {elseIfEq("subjectKey", CONSECUTIVE)}Ardışık 100 Yanlış Kod{elseBranch}E-posta Kodu Sınırının Yarısı{end}
      </Title>
      {ifEq("subjectKey", CONSECUTIVE)}
      <Paragraph>
        Keycloak&apos;ın {v("realmDisplayName")} realm&apos;inde bir hesap, ardışık 100 yanlış e-posta koduna ulaştı.
        O hesaba giriş veya hesap bağlama için yeni e-posta kodu postalanmaz ve önceki kodlar doğrulanmaz;
        kod isteyene ekran aynı görünür.
      </Paragraph>
      <Paragraph>
        Bu sayaç gün değiştiğinde veya Keycloak yeniden başlatıldığında sıfırlanmaz. Parola, passkey ya da
        YTÜ gibi mevcut başka bir yöntemle başarılı giriş veya belgelenmiş yönetici bakım sıfırlaması
        gerekir.
      </Paragraph>
      {elseIfEq("subjectKey", CEILING)}
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
        Giriş kodları sınırdan sonra da gider; kayıt kodları sınırda durur.
      </Paragraph>
      <Paragraph>
        Beklenmedik bir artışsa Keycloak olaylarına (LOGIN_ERROR, ayrıntı sky_email_code) ve SkyMail&apos;deki
        keycloak.login-code gönderimlerine bak.
      </Paragraph>
      {end}
    </Shell>
  );
}
