import * as React from "react";
import { Context, Cta, Note, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "club.role-membership",
  name: "Kulüp · Yönetim Grubu Üyeliği Değişti",
  subject: "SKY LAB yönetim yetkilerinde değişiklik",
  system: false,
  contentSensitive: false,
  brand: "account",
  trigger:
    "core-backend, admin panelinde bir kişi ayrıcalıklı bir gruba (Yönetim Kurulu, Denetim Kurulu, yönetici grubu ya da bunların alt grupları; AUTHZ_PRIVILEGED_ROOTS) eklendiğinde veya oradan çıkarıldığında; değişikliği kuyruğa yazar ve SkyMail'e anahtarla gönderir (docs/team-membership-mail.md).",
  // Action: `added` ise eklendi, değilse çıkarıldı. Role: grubun bağlı olduğu
  // kök: `board` (YK, Yönetim Kurulu), `audit` (DK, Denetim Kurulu), `admin`
  // (ADMIN) ya da `privileged` (metnin adını bilmediği bir kök); eksikse genel
  // metne düşer. GroupName: değişen grubun kendisi, "KOD · Türkçe ad"
  // (YK · Yönetim Kurulu), alt grupta kendi adı (BASKAN). ActorName boş
  // gelebilir.
  //
  // Metin bilerek nötr: değişen grup kökün kendisi de olabilir bir alt grubu
  // da (/UYELER/YK/BASKAN), kişi başka bir yönetim grubunda da olabilir. Core
  // bunları göndermiyor; bu yüzden başlık "Kurul'a eklendin" ya da "üyeliğin
  // sona erdi" demez, çıkarma yalnız bu grup üzerinden gelen yetkiler için
  // konuşur.
  variables: ["GroupName", "Role", "Action", "EffectiveAt", "ActorName"],
  sample: {
    GroupName: "YK · Yönetim Kurulu",
    Role: "board",
    Action: "added",
    EffectiveAt: "12.10.2026",
    ActorName: "Fatih Naz",
  },
};

export default function ClubRoleMembership() {
  const added = ifEq("Action", "added");
  const board = ifEq("Role", "board");
  const audit = elseIfEq("Role", "audit");
  const admin = elseIfEq("Role", "admin");

  return (
    <Shell preview="SKY LAB yönetim yetkilerinde değişiklik." brand="account" reason={null}>
      {added}
      <Context tone="ok">{v("GroupName")}</Context>
      {elseBranch}
      <Context tone="neutral">{v("GroupName")}</Context>
      {end}
      <Title>
        {added}Bir Yönetim Grubuna Eklendin{elseBranch}Bir Yönetim Grubundan Çıkarıldın{end}
      </Title>

      <Paragraph>
        {added}
        <Strong>{v("GroupName")}</Strong> grubuna eklendin.{" "}
        {board}Bu grup SKY LAB Yönetim Kurulu&apos;na bağlı.{audit}Bu grup SKY LAB Denetim Kurulu&apos;na bağlı.
        {admin}Bu grup SKY LAB&apos;in yönetici grubuna bağlı.{elseBranch}Bu grup SKY LAB&apos;in yönetim gruplarından biri.
        {end}{" "}
        Bu grubun yönetim yetkileri hesabına tanımlandı.
        {elseBranch}
        <Strong>{v("GroupName")}</Strong> grubundan çıkarıldın.{" "}
        {board}Bu grup SKY LAB Yönetim Kurulu&apos;na bağlı.{audit}Bu grup SKY LAB Denetim Kurulu&apos;na bağlı.
        {admin}Bu grup SKY LAB&apos;in yönetici grubuna bağlı.{elseBranch}Bu grup SKY LAB&apos;in yönetim gruplarından biri.
        {end}{" "}
        Bu grup üzerinden gelen yetkiler hesabından kaldırıldı.
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

      <Note tone="alert">Bu değişikliği beklemiyorsan hemen kulüp yöneticilerine haber ver.</Note>

      <Cta href="https://my.yildizskylab.com/izinler">İzinlerimi Gör</Cta>
    </Shell>
  );
}
