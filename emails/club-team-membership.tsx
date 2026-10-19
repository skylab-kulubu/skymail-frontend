import * as React from "react";
import { Context, Cta, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "club.team-membership",
  name: "Kulüp · Takım Üyeliği Değişti",
  subject: "SKY LAB takım üyeliğinde değişiklik",
  system: false,
  contentSensitive: false,
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
    <Shell preview="SKY LAB takım üyeliğinde değişiklik." brand="account" reason={null}>
      {added}
      <Context tone="ok">{v("TeamName")}</Context>
      {elseBranch}
      <Context tone="neutral">{v("TeamName")}</Context>
      {end}
      <Title>
        {added}
        {leader}Takım Liderliğine Eklendin{coordinator}Takım Koordinatörlüğüne Eklendin{elseBranch}Takıma Eklendin{end}
        {elseBranch}
        {leader}Takım Liderliğin Sona Erdi{coordinator}Takım Koordinatörlüğün Sona Erdi{elseBranch}Takım Üyeliğin Sona Erdi
        {end}
        {end}
      </Title>

      <Paragraph>
        {added}
        {leader}
        <Strong>{v("TeamName")}</Strong> takımına lider olarak eklendin; takımın yönetim yetkileri hesabına
        tanımlandı.
        {coordinator}
        <Strong>{v("TeamName")}</Strong> takımına koordinatör olarak eklendin; takımın yönetim yetkileri hesabına
        tanımlandı.
        {elseBranch}
        <Strong>{v("TeamName")}</Strong> takımına üye olarak eklendin.
        {end}
        {elseBranch}
        {leader}
        <Strong>{v("TeamName")}</Strong> takımındaki liderlik görevin ve ona bağlı yönetim yetkilerin sona erdi.
        Diğer üyeliklerin sürüyor.
        {coordinator}
        <Strong>{v("TeamName")}</Strong> takımındaki koordinatörlük görevin ve ona bağlı yönetim yetkilerin sona erdi.
        Diğer üyeliklerin sürüyor.
        {elseBranch}
        <Strong>{v("TeamName")}</Strong> takımındaki üyeliğin sona erdi; takıma özel izinlerin kaldırıldı. SKY LAB
        üyeliğin sürüyor.
        {end}
        {end}
      </Paragraph>

      <Rows>
        <RowItem label="Takım">{v("TeamName")}</RowItem>
        <RowItem label="Geçerlilik">{v("EffectiveAt")}</RowItem>
        {ifSet("LeaderName")}
        <RowItem label="İşlemi yapan">{v("LeaderName")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>

      <Cta href="https://my.yildizskylab.com/izinler">İzinlerimi Gör</Cta>
    </Shell>
  );
}
