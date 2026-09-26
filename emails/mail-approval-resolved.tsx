import * as React from "react";
import { Chip, Cta, DetailRow, Heading, Note, Paragraph, Shell, Strong } from "./theme";
import { elseBranch, elseIfEq, end, ifEq, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "mail.approval-resolved",
  name: "Mail Onayı · Sonuçlandı",
  // The outcome is the first thing the reader needs, and Decision is sent on
  // every notification, so it is safe in a subject (a missing variable would
  // print "<no value>" here, unlike in the body).
  // The last branch is deliberately vague rather than "reddedildi": a decision
  // this template does not know yet must not be reported as a rejection.
  subject:
    ifEq("Decision", "approved") + "Gönderimin onaylandı ve gitti" +
    elseIfEq("Decision", "rejected") + "Gönderimin reddedildi" +
    elseIfEq("Decision", "returned") + "Gönderimin sana geri döndü" +
    elseIfEq("Decision", "expired") + "Gönderimin süresi doldu" +
    elseIfEq("Decision", "declined") + "Gönderimdeki düzenleme kabul edilmedi" +
    elseBranch + "Gönderim isteğin sonuçlandı" + end,
  system: false,
  brand: "skylab",
  trigger:
    "SkyMail, bir onay isteği sonuçlandığında. approved/rejected/returned/expired talebi açana, declined onaycılara gider (ADR-0031, ticket 19).",
  // AudienceKind is the request's audience.kind: mailing_list, single or
  // people. RecipientCount is in digits: once approved, how many it was sent
  // to; before that, how many it would reach ("?" when Keycloak did not name a
  // group's members in time).
  variables: [
    "TemplateName",
    "AudienceName",
    "AudienceKind",
    "RecipientCount",
    "Decision",
    "DecidedBy",
    "DecisionNote",
    "RequestUrl",
    "DeadlineAt",
  ],
  sample: {
    TemplateName: "GECEKODU Duyurusu",
    AudienceName: "GECEKODU katılımcıları",
    AudienceKind: "mailing_list",
    RecipientCount: "312",
    Decision: "returned",
    DecidedBy: "Fatih Naz",
    DecisionNote: "Tarih satırını düzelttim, bir de başlığı kısalttım. Sana uyuyorsa onayla.",
    RequestUrl: "https://mail.yildizskylab.com/mail-approvals/show/6f3d2c61",
    DeadlineAt: "26 Eyl 2026 18:00",
  },
};

/**
 * One template for five outcomes, because they share everything but a sentence:
 * the same request, the same details, the same note from whoever decided.
 *
 * Only `returned` asks the reader to do something, so only it gets the button.
 * Giving every outcome one would teach people to ignore it, and the one that
 * matters is the one that would then be missed.
 *
 * `declined` is the odd one: it goes to the approvers rather than to whoever
 * submitted, and it is impersonal on purpose — "the edit that was made", never
 * "your edit". More than one approver can receive it and only one of them made
 * the edit; an approver may also approve their own request, in which case the
 * reader is the person who declined, and "your edit was not accepted" would be
 * exactly backwards.
 *
 * An approval says where the mail went: a list by name ("… listesine"),
 * people by how many ("3 kişiye"). A sender that does not give AudienceKind
 * (a SkyMail before it did) gets "alıcılara", as before.
 */
export default function MailApprovalResolved() {
  const approved = ifEq("Decision", "approved");
  const rejected = elseIfEq("Decision", "rejected");
  const returned = elseIfEq("Decision", "returned");
  const expired = elseIfEq("Decision", "expired");
  const declined = elseIfEq("Decision", "declined");

  return (
    <Shell preview={`SkyMail onay isteği sonuçlandı: ${v("TemplateName")}`} brand="skylab">
      <Heading>
        {approved}Gönderimin Onaylandı
        {rejected}Gönderimin Reddedildi
        {returned}Gönderimin Sana Geri Döndü
        {expired}Gönderimin Süresi Doldu
        {declined}Düzenleme Kabul Edilmedi
        {elseBranch}Gönderim İsteğin Sonuçlandı
        {end}
      </Heading>

      {approved}
      <Chip>Onaylandı</Chip>
      {rejected}
      <Chip tone="alert">Reddedildi</Chip>
      {returned}
      <Chip>Sana geri döndü</Chip>
      {expired}
      <Chip tone="alert">Süresi doldu</Chip>
      {declined}
      <Chip tone="alert">Kabul edilmedi</Chip>
      {elseBranch}
      <Chip>{v("Decision")}</Chip>
      {end}

      <Paragraph style={{ marginTop: "18px" }}>
        {approved}
        <Strong>{v("TemplateName")}</Strong> gönderimin {v("DecidedBy")} tarafından onaylandı ve
        {ifEq("AudienceKind", "mailing_list")} <Strong>{v("AudienceName")}</Strong> listesine
        {elseIfEq("AudienceKind", "people")} <Strong>{v("RecipientCount")} kişiye</Strong>
        {elseIfEq("AudienceKind", "single")} <Strong>{v("RecipientCount")} kişiye</Strong>
        {elseBranch} alıcılara
        {end} iletildi.
        {rejected}
        <Strong>{v("TemplateName")}</Strong> gönderimin {v("DecidedBy")} tarafından reddedildi ve
        gönderilmedi. Düzeltip yeniden sunabilirsin.
        {returned}
        <Strong>{v("TemplateName")}</Strong> gönderimini {v("DecidedBy")} düzenledi ve senin onayına
        geri gönderdi. Gitmesi için senin bakman gerekiyor.
        {expired}
        <Strong>{v("TemplateName")}</Strong> gönderimi için süresi içinde karar verilmedi, o yüzden
        gönderilmedi. Bu isteği yeniden sunamazsın; hâlâ gerekiyorsa yeni bir istek aç.
        {declined}
        <Strong>{v("TemplateName")}</Strong> gönderiminde yapılan düzenlemeyi {v("DecidedBy")} kabul
        etmedi, gönderim yapılmadı.
        {elseBranch}
        <Strong>{v("TemplateName")}</Strong> gönderim isteğinin durumu {v("DecidedBy")} tarafından
        güncellendi. Ayrıntı için isteğin sayfasına bak.
        {end}
      </Paragraph>

      {ifSet("DecisionNote")}
      <div style={{ marginTop: "24px" }}>
        <Note>{v("DecisionNote")}</Note>
      </div>
      {end}

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
        {ifSet("RecipientCount")}
        <DetailRow label="Alıcı sayısı" value={v("RecipientCount")} />
        {end}
        {ifSet("DeadlineAt")}
        <DetailRow label="Son tarih" value={v("DeadlineAt")} />
        {end}
        <DetailRow label="Karar veren" value={v("DecidedBy")} last />
      </div>

      {/* Only the outcome that needs the reader to act carries a button. */}
      {ifEq("Decision", "returned")}
      {ifSet("RequestUrl")}
      <Cta href={v("RequestUrl")}>Düzenlemeyi İncele</Cta>
      {end}
      {end}
    </Shell>
  );
}
