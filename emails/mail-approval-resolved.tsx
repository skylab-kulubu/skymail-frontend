import * as React from "react";
import { Chip, DetailRow, Heading, Note, Paragraph, Shell, Strong } from "./theme";
import { elseBranch, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "mail.approval-resolved",
  name: "Mail Onayı · Sonuçlandı",
  subject: "Gönderim talebin sonuçlandı",
  system: false,
  brand: "skylab",
  trigger: "SkyMail, bir onaycı gönderimi onayladığında ya da reddettiğinde, talebi açan kişiye.",
  // Decision `approved` ise onaylandı, değilse reddedildi olarak render edilir.
  variables: ["TemplateName", "AudienceName", "Decision", "DecidedBy", "DecisionNote"],
  sample: {
    TemplateName: "GECEKODU Duyurusu",
    AudienceName: "GECEKODU katılımcıları",
    Decision: "approved",
    DecidedBy: "Fatih Naz",
    DecisionNote: "Tarih satırını düzelttim, gerisi iyi.",
  },
};

export default function MailApprovalResolved() {
  const approved = ifEq("Decision", "approved");

  return (
    <Shell preview="SkyMail gönderim talebin sonuçlandı." brand="skylab">
      <Heading>
        {approved}Gönderimin Onaylandı{elseBranch}Gönderimin Reddedildi{end}
      </Heading>

      {approved}
      <Chip>Onaylandı</Chip>
      {elseBranch}
      <Chip tone="alert">Reddedildi</Chip>
      {end}

      <Paragraph style={{ marginTop: "18px" }}>
        <Strong>{v("TemplateName")}</Strong> gönderimin {v("DecidedBy")} tarafından{" "}
        {approved}onaylandı ve alıcılara iletildi{elseBranch}reddedildi ve gönderilmedi{end}.
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Şablon" value={v("TemplateName")} />
        <DetailRow label="Alıcı listesi" value={v("AudienceName")} />
        <DetailRow label="Karar veren" value={v("DecidedBy")} last />
      </div>

      {ifSet("DecisionNote")}
      <div style={{ marginTop: "24px" }}>
        <Note>{v("DecisionNote")}</Note>
      </div>
      {end}
    </Shell>
  );
}
