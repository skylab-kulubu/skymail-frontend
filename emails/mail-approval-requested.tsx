import * as React from "react";
import { Context, Cta, Note, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, Strong, Title } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "mail.approval-requested",
  name: "Mail Onayı · Onayını Bekliyor",
  subject: "Onayını bekleyen bir gönderim var",
  system: false,
  contentSensitive: false,
  brand: "mail",
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
    <Shell preview="SkyMail'de onayını bekleyen bir gönderim var." brand="mail" reason={null}>
      <Context tone="wait">Mail onayı</Context>
      <Title>Onayını Bekleyen Gönderim</Title>

      <Paragraph>
        <Strong>{v("RequesterName")}</Strong> bir gönderim hazırladı ve senin onayını bekliyor.
        {toList} Gönderim <Strong>{v("AudienceName")}</Strong> listesine gidecek.
        {toPeople} Gönderim <Strong>{v("RecipientCount")} kişiye</Strong> gidecek.
        {toOne} Gönderim <Strong>{v("RecipientCount")} kişiye</Strong> gidecek.
        {end}
      </Paragraph>

      <Rows>
        <RowItem label="Şablon">{v("TemplateName")}</RowItem>
        <RowItem
          label={
            <>
              {ifEq("AudienceKind", "people")}Alıcılar{elseIfEq("AudienceKind", "single")}Alıcı{elseBranch}Alıcı listesi
              {end}
            </>
          }
        >
          {v("AudienceName")}
        </RowItem>
        <RowItem label="Alıcı sayısı">{v("RecipientCount")}</RowItem>
        <RowsEnd />
      </Rows>

      <Note>Onaydan sonra gönderim geri alınamaz.</Note>

      <Cta href={v("ApproveUrl")}>Gönderimi İncele</Cta>

      {ifSet("PreviewUrl")}
      <Small style={{ wordBreak: "break-all" }}>Önizleme: {v("PreviewUrl")}</Small>
      {end}
    </Shell>
  );
}
