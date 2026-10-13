import * as React from "react";
import { Context, Cta, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
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
    <Shell
      preview="SKY LAB grup üyeliğinde bir değişiklik oldu."
      brand="account"
      reason="Bu e-postayı, bir SKY LAB grubundaki üyeliğin değiştiği için alıyorsun."
    >
      {added}
      <Context tone="ok">{v("GroupName")}</Context>
      {elseBranch}
      <Context tone="neutral">{v("GroupName")}</Context>
      {end}
      <Title>
        {added}Bir Gruba Eklendin{elseBranch}Bir Gruptan Çıkarıldın{end}
      </Title>

      <Paragraph>
        {added}
        <Strong>{v("GroupName")}</Strong> grubuna eklendin. Bu gruba bağlı izinler varsa hesabına tanımlandı.
        {elseBranch}
        <Strong>{v("GroupName")}</Strong> grubundan çıkarıldın. Bu gruba bağlı izinler varsa hesabından kaldırıldı.
        {end}
      </Paragraph>

      <Rows>
        <RowItem label="Grup">{v("GroupName")}</RowItem>
        <RowItem label="Geçerlilik">{v("EffectiveAt")}</RowItem>
        {ifSet("ActorName")}
        <RowItem label="İşlemi yapan">{v("ActorName")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>

      <Paragraph style={{ marginTop: "24px" }}>
        Hesabındaki güncel yetkileri her zaman Hesap Merkezi&apos;ndeki İzinler ekranından görebilirsin.
      </Paragraph>

      <Cta href="https://my.yildizskylab.com/izinler">İzinlerimi Gör</Cta>
    </Shell>
  );
}
