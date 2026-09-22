import * as React from "react";
import { Chip, Cta, DetailRow, Heading, Paragraph, Shell, Strong } from "./theme";
import { elseBranch, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "club.team-membership",
  name: "Kulüp · Takım Üyeliği Değişti",
  subject: "SKY LAB takım üyeliğinde değişiklik",
  system: false,
  brand: "account",
  trigger:
    "Superadmin'de bir kişi takıma eklendiğinde veya çıkarıldığında. NOT: gönderim kodu henüz yazılmadı.",
  // Action `added` ise eklendi, değilse çıkarıldı olarak render edilir.
  variables: ["TeamName", "Action", "EffectiveAt", "LeaderName"],
  sample: {
    TeamName: "WEBLAB",
    Action: "added",
    EffectiveAt: "22.09.2026",
    LeaderName: "Fatih Naz",
  },
};

export default function ClubTeamMembership() {
  const added = ifEq("Action", "added");

  return (
    <Shell preview="SKY LAB takım üyeliğinde bir değişiklik oldu." brand="account">
      <Heading>
        {added}Takıma Eklendin{elseBranch}Takım Üyeliğin Sona Erdi{end}
      </Heading>

      {added}
      <Chip>{v("TeamName")}</Chip>
      {elseBranch}
      <Chip tone="alert">{v("TeamName")}</Chip>
      {end}

      <Paragraph style={{ marginTop: "18px" }}>
        {added}
        <Strong>{v("TeamName")}</Strong> takımına eklendin. Takımın etkinliklerini ve içeriklerini yönetme yetkilerin
        hesabına tanımlandı.
        {elseBranch}
        <Strong>{v("TeamName")}</Strong> takımındaki üyeliğin sona erdi. Takıma özel yetkilerin hesabından kaldırıldı;
        SKY LAB üyeliğin devam ediyor.
        {end}
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Takım" value={v("TeamName")} />
        {ifSet("EffectiveAt")}
        <DetailRow label="Geçerlilik" value={v("EffectiveAt")} />
        {end}
        {ifSet("LeaderName")}
        <DetailRow label="İşlemi yapan" value={v("LeaderName")} last />
        {end}
      </div>

      <Paragraph style={{ marginTop: "24px" }}>
        Hesabındaki güncel yetkileri her zaman Hesap Merkezi'ndeki İzinler ekranından görebilirsin.
      </Paragraph>

      <Cta href="https://my.yildizskylab.com/izinler">İzinlerimi Gör</Cta>
    </Shell>
  );
}
