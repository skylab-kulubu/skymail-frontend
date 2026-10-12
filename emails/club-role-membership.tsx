import * as React from "react";
import { Chip, Cta, DetailRow, Heading, Note, Paragraph, Shell, Strong } from "./theme";
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
    <Shell preview="SKY LAB yönetim yetkilerinde bir değişiklik oldu." brand="account">
      <Heading>
        {added}
        {board}Yönetim Kurulu&apos;na Eklendin{audit}Denetim Kurulu&apos;na Eklendin{admin}Yönetici Grubuna Eklendin
        {elseBranch}Bir Yönetim Grubuna Eklendin{end}
        {elseBranch}
        {board}Yönetim Kurulu Üyeliğin Sona Erdi{audit}Denetim Kurulu Üyeliğin Sona Erdi{admin}Yöneticiliğin Sona Erdi
        {elseBranch}Yönetim Grubu Üyeliğin Sona Erdi{end}
        {end}
      </Heading>

      {added}
      <Chip>{v("GroupName")}</Chip>
      {elseBranch}
      <Chip tone="alert">{v("GroupName")}</Chip>
      {end}

      <Paragraph style={{ marginTop: "18px" }}>
        {added}
        <Strong>{v("GroupName")}</Strong> grubuna eklendin.{" "}
        {board}Bu grup SKY LAB Yönetim Kurulu&apos;na bağlı.{audit}Bu grup SKY LAB Denetim Kurulu&apos;na bağlı.
        {admin}Bu grup SKY LAB&apos;in yönetici grubu.{elseBranch}Bu grup SKY LAB&apos;in yönetim gruplarından biri.{end}{" "}
        Grubun yönetim yetkileri hesabına tanımlandı: yönetim panelinde kulübün üyeleri, grupları ve içerikleri
        üzerinde işlem yapabilirsin.
        {elseBranch}
        <Strong>{v("GroupName")}</Strong> grubundan çıkarıldın. Bu gruba bağlı yönetim yetkilerin hesabından
        kaldırıldı; SKY LAB üyeliğin devam ediyor.
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

      <Note tone="alert">
        Bu değişikliği beklemiyorsan hemen kulüp yöneticilerine haber ver.
      </Note>

      <Paragraph style={{ marginTop: "24px" }}>
        Hesabındaki güncel yetkileri her zaman Hesap Merkezi&apos;ndeki İzinler ekranından görebilirsin.
      </Paragraph>

      <Cta href="https://my.yildizskylab.com/izinler">İzinlerimi Gör</Cta>
    </Shell>
  );
}
