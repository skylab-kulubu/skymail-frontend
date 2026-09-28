import * as React from "react";
import { Cta, DetailRow, Heading, Note, Paragraph, Shell, Strong } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "mail.approval-requested",
  name: "Mail Onayı · Onayını Bekliyor",
  subject: "Onayını bekleyen bir gönderim var",
  system: false,
  brand: "skylab",
  trigger:
    "SkyMail, gönderme yetkisi olmayan biri taslak gönderdiğinde onaycılara (ADR-0031, CONTEXT.md \"Mail onayı\", ticket 19).",
  // AudienceKind is the request's audience.kind: mailing_list, single or
  // people. RecipientCount is in digits, or "?" when Keycloak did not name a
  // group's members in time.
  variables: ["RequesterName", "TemplateName", "AudienceName", "AudienceKind", "RecipientCount", "PreviewUrl", "ApproveUrl"],
  sample: {
    RequesterName: "Elif Yıldız",
    TemplateName: "GECEKODU Duyurusu",
    AudienceName: "GECEKODU katılımcıları",
    AudienceKind: "mailing_list",
    RecipientCount: "312",
    PreviewUrl: "https://mail.yildizskylab.com/mail_tasks/ornek",
    ApproveUrl: "https://mail.yildizskylab.com/mail_tasks/ornek/onay",
  },
};

/**
 * A list is named ("… listesine"), people are counted ("3 kişiye"): a list's
 * members are not known by name here, and several people are named in
 * AudienceName already. A sender that does not give AudienceKind (a SkyMail
 * before it did) gets neither sentence and the rows as they were.
 */
export default function MailApprovalRequested() {
  const toList = ifEq("AudienceKind", "mailing_list");
  const toPeople = elseIfEq("AudienceKind", "people");
  const toOne = elseIfEq("AudienceKind", "single");

  return (
    <Shell preview="SkyMail'de onayını bekleyen bir gönderim var." brand="skylab">
      <Heading>Onayını Bekleyen Gönderim</Heading>

      <Paragraph>
        <Strong>{v("RequesterName")}</Strong> bir gönderim hazırladı ve senin onayını bekliyor.
        {toList} Gönderim <Strong>{v("AudienceName")}</Strong> listesine gidecek.
        {toPeople} Gönderim <Strong>{v("RecipientCount")} kişiye</Strong> gidecek; her biri kendi mailini ayrı alır.
        {toOne} Gönderim <Strong>{v("RecipientCount")} kişiye</Strong> gidecek.
        {end} Onaylarsan mail olduğu gibi gider; onaylamazsan hiçbir şey gönderilmez.
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Şablon" value={v("TemplateName")} />
        <DetailRow
          label={
            <>
              {ifEq("AudienceKind", "people")}Alıcılar{elseIfEq("AudienceKind", "single")}Alıcı{elseBranch}Alıcı listesi
              {end}
            </>
          }
          value={v("AudienceName")}
        />
        <DetailRow label="Alıcı sayısı" value={v("RecipientCount")} last />
      </div>

      <div style={{ marginTop: "24px" }}>
        <Note>Onaylamadan önce gönderimi önizle — onaydan sonra geri alınamaz.</Note>
      </div>

      <Cta href={v("ApproveUrl")}>Gönderimi İncele</Cta>

      {ifSet("PreviewUrl")}
      <Paragraph style={{ marginTop: "18px", fontSize: "13px" }}>
        Sadece önizlemek istersen: {v("PreviewUrl")}
      </Paragraph>
      {end}
    </Shell>
  );
}
