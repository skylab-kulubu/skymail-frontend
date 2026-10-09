import * as React from "react";
import { Chip, Cta, DetailRow, Heading, Paragraph, Shell, Strong } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "club.team-membership",
  name: "Kulüp · Takım Üyeliği Değişti",
  subject: "SKY LAB takım üyeliğinde değişiklik",
  system: false,
  brand: "account",
  trigger:
    "core-backend, admin panelinde bir kişi bir takıma ya da takımın LIDERLER/KOORDINATORLER alt grubuna eklendiğinde veya oradan çıkarıldığında; değişikliği kuyruğa yazar ve SkyMail'e anahtarla gönderir (core-backend#215, docs/team-membership-mail.md).",
  // Action: `added` ise eklendi, değilse çıkarıldı. Role: `member` (takımın
  // kendisi), `leader` (LIDERLER) ya da `coordinator` (KOORDINATORLER); yönetim
  // yetkisi yalnız lider ve koordinatörlerde, metin buna göre değişir.
  // TeamName: takımın "KOD · Türkçe ad"ı (WEBLAB · Web Geliştirme), lider ve
  // koordinatör değişikliklerinde de; rol Role ile gelir. Role eksikse metin
  // üye metnine düşer. LeaderName boş gelebilir.
  variables: ["TeamName", "Action", "Role", "EffectiveAt", "LeaderName"],
  sample: {
    TeamName: "WEBLAB · Web Geliştirme",
    Action: "added",
    Role: "member",
    EffectiveAt: "22.09.2026",
    LeaderName: "Fatih Naz",
  },
};

export default function ClubTeamMembership() {
  const added = ifEq("Action", "added");
  const leader = ifEq("Role", "leader");
  const coordinator = elseIfEq("Role", "coordinator");

  return (
    <Shell preview="SKY LAB takım üyeliğinde bir değişiklik oldu." brand="account">
      <Heading>
        {added}
        {leader}Takım Liderliğine Eklendin{coordinator}Takım Koordinatörlüğüne Eklendin{elseBranch}Takıma Eklendin{end}
        {elseBranch}
        {leader}Takım Liderliğin Sona Erdi{coordinator}Takım Koordinatörlüğün Sona Erdi{elseBranch}Takım Üyeliğin Sona Erdi
        {end}
        {end}
      </Heading>

      {added}
      <Chip>{v("TeamName")}</Chip>
      {elseBranch}
      <Chip tone="alert">{v("TeamName")}</Chip>
      {end}

      <Paragraph style={{ marginTop: "18px" }}>
        {added}
        {leader}
        <Strong>{v("TeamName")}</Strong> takımına lider olarak eklendin. Takımın etkinliklerini ve içeriklerini
        yönetme yetkilerin hesabına tanımlandı.
        {coordinator}
        <Strong>{v("TeamName")}</Strong> takımına koordinatör olarak eklendin. Takımın etkinliklerini ve içeriklerini
        yönetme yetkilerin hesabına tanımlandı.
        {elseBranch}
        <Strong>{v("TeamName")}</Strong> takımına üye olarak eklendin. Aramıza hoş geldin!
        {end}
        {elseBranch}
        {leader}
        <Strong>{v("TeamName")}</Strong> takımındaki liderlik görevin ve ona bağlı yönetim yetkilerin sona erdi.
        Değişiklik yalnız bu görevi kapsar: takıma ayrıca üyeysen o üyeliğin sürüyor, SKY LAB üyeliğin de devam ediyor.
        {coordinator}
        <Strong>{v("TeamName")}</Strong> takımındaki koordinatörlük görevin ve ona bağlı yönetim yetkilerin sona erdi.
        Değişiklik yalnız bu görevi kapsar: takıma ayrıca üyeysen o üyeliğin sürüyor, SKY LAB üyeliğin de devam ediyor.
        {elseBranch}
        <Strong>{v("TeamName")}</Strong> takımındaki üyeliğin sona erdi. Takıma özel izinlerin hesabından kaldırıldı;
        SKY LAB üyeliğin devam ediyor.
        {end}
        {end}
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Takım" value={v("TeamName")} />
        {ifSet("LeaderName")}
        <DetailRow label="Geçerlilik" value={v("EffectiveAt")} />
        <DetailRow label="İşlemi yapan" value={v("LeaderName")} last />
        {elseBranch}
        <DetailRow label="Geçerlilik" value={v("EffectiveAt")} last />
        {end}
      </div>

      <Paragraph style={{ marginTop: "24px" }}>
        Hesabındaki güncel yetkileri her zaman Hesap Merkezi'ndeki İzinler ekranından görebilirsin.
      </Paragraph>

      <Cta href="https://my.yildizskylab.com/izinler">İzinlerimi Gör</Cta>
    </Shell>
  );
}
