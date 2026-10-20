import * as React from "react";
import { Context, Cta, Note, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "club.privilege-change",
  name: "Kulüp · Yetki Değişikliği Bildirimi",
  subject: "SKY LAB yönetim yetkilerinde değişiklik bildirimi",
  system: false,
  contentSensitive: false,
  brand: "account",
  trigger:
    "core-backend, yönetim yetkisi veren bir değişiklikte (docs/privilege-change-mail.md): bir grubun rol eşlemesi değişince yalnız ADMIN üyelerine; bir yönetim grubuna (ADMIN, YK, DK ya da altları; AUTHZ_PRIVILEGED_ROOTS) kişi eklenince ya da çıkarılınca ADMIN üyelerine ve o kökün diğer üyelerine. Değişikliği yapan ve eklenen/çıkarılan kişi bu postayı almaz; kişi kendi club.role-membership postasını alır. Core kuyruğa yazar ve SkyMail'e anahtarla gönderir.",
  // Change: `member-added`, `member-removed` ya da `roles-changed`.
  // GroupName: değişen grup, "KOD · Türkçe ad" (YK · Yönetim Kurulu), alt
  // grupta kendi adı (BASKAN). GroupId: panel bağlantısı için grubun kimliği;
  // grup silinmişse boş. Root: üyelik olaylarında grubun bağlı olduğu kök
  // (`board`, `audit`, `admin`, `privileged`), rol eşlemesinde boş.
  // SubjectName: eklenen/çıkarılan kişinin adı, rol eşlemesinde ya da adı
  // gösterilemeyen kişide boş. ActorName boş gelebilir. OccurredAt:
  // "dd.MM.yyyy HH:mm" (İstanbul). RolesAdded / RolesRemoved: "client:rol"
  // listesi, virgülle (realm rolü "realm:ROL"); boş gelebilir. AdminRole:
  // değişen rollerden biri core'un rol sınıflarına göre yönetici rolüyse
  // (cms:access, content:write, client:admin, core izinleri, realm rolleri
  // dahil) `yes`; uygulama rolü ya da sınıflandırılmamış rolse `no`.
  // MemberCount: rol eşlemesinde grubun alt ağacındaki kişi sayısı.
  // Core her anahtarı her zaman gönderir; uymayanlar boştur.
  variables: [
    "Change",
    "GroupName",
    "GroupId",
    "Root",
    "SubjectName",
    "ActorName",
    "OccurredAt",
    "RolesAdded",
    "RolesRemoved",
    "AdminRole",
    "MemberCount",
  ],
  sample: {
    Change: "member-added",
    GroupName: "YK · Yönetim Kurulu",
    GroupId: "6f3d2c61-8a1e-4f5b-9f21-2b7c4de90a13",
    Root: "board",
    SubjectName: "Ada Lovelace",
    ActorName: "Fatih Naz",
    OccurredAt: "12.10.2026 22:15",
    RolesAdded: "",
    RolesRemoved: "",
    AdminRole: "no",
    MemberCount: "",
  },
};

export default function ClubPrivilegeChange() {
  const added = ifEq("Change", "member-added");
  const removed = elseIfEq("Change", "member-removed");
  const board = ifEq("Root", "board");
  const audit = elseIfEq("Root", "audit");
  const admin = elseIfEq("Root", "admin");
  const subject = (
    <>
      {ifSet("SubjectName")}
      <Strong>{v("SubjectName")}</Strong>
      {elseBranch}Bir hesap{end}
    </>
  );
  const rootSentence = (
    <>
      {board}Bu grup SKY LAB Yönetim Kurulu&apos;na bağlı.{audit}Bu grup SKY LAB Denetim Kurulu&apos;na bağlı.
      {admin}Bu grup SKY LAB&apos;in yönetici grubuna bağlı.{elseBranch}Bu grup SKY LAB&apos;in yönetim gruplarından biri.
      {end}
    </>
  );
  return (
    <Shell preview="SKY LAB yönetim yetkilerinde değişiklik." brand="account" reason={null}>
      {ifEq("Change", "member-removed")}
      <Context tone="bad">{v("GroupName")}</Context>
      {elseBranch}
      <Context tone="wait">{v("GroupName")}</Context>
      {end}
      <Title>
        {added}Bir Yönetim Grubuna Üye Eklendi{removed}Bir Yönetim Grubundan Üye Çıkarıldı{elseBranch}Bir Grubun Rolleri
        Değişti{end}
      </Title>

      <Paragraph>
        {added}
        {subject}, <Strong>{v("GroupName")}</Strong> grubuna eklendi. {rootSentence} Bu grubun yönetim yetkileri artık
        bu hesapta.
        {removed}
        {subject}, <Strong>{v("GroupName")}</Strong> grubundan çıkarıldı. {rootSentence} Bu grup üzerinden gelen
        yetkiler bu hesaptan kaldırıldı.
        {elseBranch}
        <Strong>{v("GroupName")}</Strong> grubunun rol eşlemesi değişti; gruptaki ve alt gruplarındaki herkes
        etkilenir.
        {ifEq("AdminRole", "yes")} Değişen rollerden en az biri bir yönetici rolü.{end}
        {end}
      </Paragraph>

      <Rows>
        <RowItem label="Grup">{v("GroupName")}</RowItem>
        {ifSet("SubjectName")}
        <RowItem label="Kişi">{v("SubjectName")}</RowItem>
        {end}
        {ifSet("RolesAdded")}
        <RowItem label="Eklenen roller">{v("RolesAdded")}</RowItem>
        {end}
        {ifSet("RolesRemoved")}
        <RowItem label="Kaldırılan roller">{v("RolesRemoved")}</RowItem>
        {end}
        {ifSet("MemberCount")}
        <RowItem label="Etkilenen kişi">{v("MemberCount")}</RowItem>
        {end}
        {ifSet("ActorName")}
        <RowItem label="İşlemi yapan">{v("ActorName")}</RowItem>
        {end}
        <RowItem label="Zaman">{v("OccurredAt")}</RowItem>
        <RowsEnd />
      </Rows>

      <Note tone="alert">Bu değişikliği beklemiyorsan hemen kulüp yöneticilerine haber ver.</Note>

      {ifSet("GroupId")}
      <Cta href={`https://admin.yildizskylab.com/groups/${v("GroupId")}`}>Grubu Panelde Aç</Cta>
      {end}
    </Shell>
  );
}
