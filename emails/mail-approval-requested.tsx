import * as React from "react";
import { Cta, DetailRow, Heading, Note, Paragraph, Shell, Strong } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "mail.approval-requested",
  name: "Mail Onayı · Onayını Bekliyor",
  subject: "Onayını bekleyen bir gönderim var",
  system: false,
  brand: "skylab",
  trigger:
    "SkyMail, gönderme yetkisi olmayan biri taslak gönderdiğinde onaycılara (ADR-0031, CONTEXT.md \"Mail onayı\", ticket 19).",
  variables: ["RequesterName", "TemplateName", "AudienceName", "RecipientCount", "PreviewUrl", "ApproveUrl"],
  sample: {
    RequesterName: "Elif Yıldız",
    TemplateName: "GECEKODU Duyurusu",
    AudienceName: "GECEKODU katılımcıları",
    RecipientCount: "312",
    PreviewUrl: "https://mail.yildizskylab.com/mail_tasks/ornek",
    ApproveUrl: "https://mail.yildizskylab.com/mail_tasks/ornek/onay",
  },
};

export default function MailApprovalRequested() {
  return (
    <Shell preview="SkyMail'de onayını bekleyen bir gönderim var." brand="skylab">
      <Heading>Onayını Bekleyen Gönderim</Heading>

      <Paragraph>
        <Strong>{v("RequesterName")}</Strong> bir gönderim hazırladı ve senin onayını bekliyor. Onaylarsan mail
        olduğu gibi gider; onaylamazsan hiçbir şey gönderilmez.
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Şablon" value={v("TemplateName")} />
        <DetailRow label="Alıcı listesi" value={v("AudienceName")} />
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
