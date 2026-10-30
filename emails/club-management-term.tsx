import * as React from "react";
import { Context, Cta, Paragraph, RowItem, Rows, RowsEnd, Shell, Strong, Title } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "club.management-term",
  name: "Kulüp · Yönetim Üyeliği Süresi",
  subject:
    "{{if eq .Notice `expired-list`}}Süresi dolan yönetim üyelikleri{{else if eq .Notice `weekly-summary`}}Haftalık özet: süresi dolmuş yönetim üyelikleri{{else if eq .Self `yes`}}Yönetim görevinin süresi doluyor{{else}}Bir yönetim üyeliğinin süresi doluyor{{end}}",
  system: true,
  // Names, Groups and dates; no code or link that acts as the recipient.
  contentSensitive: false,
  brand: "account",
  trigger:
    "core-backend, süreli yönetim üyeliğinin günlük işinde (MANAGEMENT_TERMS_MODE=apply; docs/management-membership-terms.md, grup-yonetimi 11): YK, DK ya da ekip liderliği üyeliğinin bitişinden 14 gün ve 1 gün önce kişiye ve üstündekilere uyarı; süre dolunca işaretlenen üyeliklerin listesi ADMIN'e; süresi dolup grubunda duranların haftalık özeti ADMIN'e. Core kuyruğa yazar ve SkyMail'e anahtarla gönderir.",
  // Notice: `warning`, `expired-list` ya da `weekly-summary`; hangi posta
  // olduğunu söyler. Uyarıda: DaysLeft `14` ya da `1`; Self alıcı üyeliğin
  // sahibiyse `yes`, değilse `no`; SubjectName sahibin adı; GroupName grup
  // ("KOD · Türkçe ad"), GroupId panel bağlantısı için kimliği (grup
  // okunamadıysa boş); Role `board`, `audit`, `privileged` ya da
  // `team-leaders`; EndsAt bitiş, "dd.MM.yyyy" (İstanbul). Listelerde: Count
  // ve Items, satırlar "\n" ile; süresi dolanlarda "Ad · Grup · dd.MM.yyyy",
  // haftalık özette "Grup: N". Core her anahtarı her zaman gönderir;
  // uymayanlar boştur (Self `no`).
  variables: ["Notice", "DaysLeft", "Self", "SubjectName", "GroupName", "GroupId", "Role", "EndsAt", "Count", "Items"],
  requiredVariables: [{ name: "Notice", reason: "Postanın türü (uyarı, süresi dolanlar, haftalık özet); kaldırılırsa posta hangisi olduğunu söyleyemez." }],
  sample: {
    Notice: "warning",
    DaysLeft: "14",
    Self: "yes",
    SubjectName: "Ada Lovelace",
    GroupName: "YK · Yönetim Kurulu",
    GroupId: "6f3d2c61-8a1e-4f5b-9f21-2b7c4de90a13",
    Role: "board",
    EndsAt: "31.05.2027",
    Count: "",
    Items: "",
  },
};

/** Items keeps core's line breaks: one term, or one Group, per line. */
function Lines() {
  return <Paragraph style={{ whiteSpace: "pre-wrap" }}>{v("Items")}</Paragraph>;
}

/**
 * The end is only marked (Yusuf, 2026-10-12): core never takes anyone out of
 * a Group. The holder cannot extend their own term; who can is the member
 * add's decision (identity.MembershipWriteDecision): Privileged with write
 * (ADMIN, YK) for any of them, and for a Team's Leader group also a Leader
 * of the Team above.
 */
export default function ClubManagementTerm() {
  const self = ifEq("Self", "yes");
  return (
    <Shell preview="SKY LAB yönetim üyeliği süresi." brand="account" reason={null}>
      {ifEq("Notice", "expired-list")}
      <Context tone="bad">Süresi dolan üyelikler</Context>
      <Title>Yönetim Üyeliklerinin Süresi Doldu</Title>
      <Paragraph>
        Şu {v("Count")} yönetim üyeliğinin süresi doldu. Kimse gruptan kendiliğinden çıkarılmadı; yetkileri sürüyor.
      </Paragraph>
      <Lines />
      <Paragraph>Uzatma, devir ya da gruptan çıkarma elle yapılır.</Paragraph>
      {elseIfEq("Notice", "weekly-summary")}
      <Context tone="wait">Haftalık özet</Context>
      <Title>Süresi Dolmuş Yönetim Üyelikleri</Title>
      <Paragraph>Süresi dolduğu hâlde grubunda duran {v("Count")} yönetim üyeliği var. Gruplara göre:</Paragraph>
      <Lines />
      <Paragraph>Uzatma, devir ya da gruptan çıkarma elle yapılır.</Paragraph>
      {elseBranch}
      <Context tone="wait">{v("GroupName")}</Context>
      <Title>
        {self}Yönetim Görevinin Süresi Doluyor{elseBranch}Bir Yönetim Üyeliğinin Süresi Doluyor{end}
      </Title>
      <Paragraph>
        {self}
        <Strong>{v("GroupName")}</Strong> grubundaki üyeliğinin süresi <Strong>{v("EndsAt")}</Strong> tarihinde doluyor;{" "}
        {v("DaysLeft")} gün kaldı.
        {elseBranch}
        <Strong>{v("SubjectName")}</Strong> adlı kişinin <Strong>{v("GroupName")}</Strong> grubundaki üyeliğinin süresi{" "}
        <Strong>{v("EndsAt")}</Strong> tarihinde doluyor; {v("DaysLeft")} gün kaldı.
        {end}
      </Paragraph>
      <Paragraph>Süre dolunca üyelik kendiliğinden kalkmaz; süresi dolmuş diye işaretlenir ve yönetici grubuna bildirilir.</Paragraph>
      <Paragraph>
        {self}
        Süreni kendin uzatamazsın. Uzatma ya da devir için{" "}
        {ifEq("Role", "team-leaders")}Yönetim Kurulu&apos;na ya da varsa üst ekibin liderlerine{elseBranch}Yönetim Kurulu&apos;na ya da
        yönetici grubuna (ADMIN){end} başvur.
        {elseBranch}
        Bu grubun üyeliğini değiştirme yetkin varsa süreyi uzatabilir ya da görevi devredebilirsin.
        {end}
      </Paragraph>
      <Rows>
        <RowItem label="Grup">{v("GroupName")}</RowItem>
        {ifEq("Self", "no")}
        <RowItem label="Kişi">{v("SubjectName")}</RowItem>
        {end}
        <RowItem label="Bitiş">{v("EndsAt")}</RowItem>
        <RowsEnd />
      </Rows>
      {ifSet("GroupId")}
      <Cta href={`https://admin.yildizskylab.com/groups/${v("GroupId")}`}>Grubu Panelde Aç</Cta>
      {end}
      {end}
    </Shell>
  );
}
