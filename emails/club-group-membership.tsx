import * as React from "react";
import { Chip, Cta, DetailRow, Heading, Paragraph, Shell, Strong } from "./theme";
import { elseBranch, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "club.group-membership",
  name: "Kulüp · Grup Üyeliği Değişti",
  subject: "SKY LAB grup üyeliğinde değişiklik",
  system: false,
  contentSensitive: false,
  brand: "account",
  trigger:
    "core-backend, admin panelinde bir kişi takım ya da yönetim grubu olmayan bir gruba (kulüp, alan grupları ör. /UYELER/ARGE, alanın LIDERLER'i, teknik gruplar) eklendiğinde veya oradan çıkarıldığında; değişikliği kuyruğa yazar ve SkyMail'e anahtarla gönderir (docs/team-membership-mail.md).",
  // Action: `added` ise eklendi, değilse çıkarıldı. GroupName: değişen grubun
  // "KOD · Türkçe ad"ı (ARGE · Ar-Ge), Türkçe adı yoksa kodu
  // (ESKI-EDITORLER). ActorName boş gelebilir.
  variables: ["GroupName", "Action", "EffectiveAt", "ActorName"],
  sample: {
    GroupName: "ARGE · Ar-Ge",
    Action: "added",
    EffectiveAt: "12.10.2026",
    ActorName: "Fatih Naz",
  },
};

export default function ClubGroupMembership() {
  const added = ifEq("Action", "added");

  return (
    <Shell preview="SKY LAB grup üyeliğinde bir değişiklik oldu." brand="account">
      <Heading>
        {added}Bir Gruba Eklendin{elseBranch}Bir Gruptan Çıkarıldın{end}
      </Heading>

      {added}
      <Chip>{v("GroupName")}</Chip>
      {elseBranch}
      <Chip tone="alert">{v("GroupName")}</Chip>
      {end}

      <Paragraph style={{ marginTop: "18px" }}>
        {added}
        <Strong>{v("GroupName")}</Strong> grubuna eklendin. Bu gruba bağlı izinler varsa hesabına tanımlandı.
        {elseBranch}
        <Strong>{v("GroupName")}</Strong> grubundan çıkarıldın. Bu gruba bağlı izinler varsa hesabından kaldırıldı.
        {end}
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Grup" value={v("GroupName")} />
        {ifSet("ActorName")}
        <DetailRow label="Geçerlilik" value={v("EffectiveAt")} />
        <DetailRow label="İşlemi yapan" value={v("ActorName")} last />
        {elseBranch}
        <DetailRow label="Geçerlilik" value={v("EffectiveAt")} last />
        {end}
      </div>

      <Paragraph style={{ marginTop: "24px" }}>
        Hesabındaki güncel yetkileri her zaman Hesap Merkezi&apos;ndeki İzinler ekranından görebilirsin.
      </Paragraph>

      <Cta href="https://my.yildizskylab.com/izinler">İzinlerimi Gör</Cta>
    </Shell>
  );
}
