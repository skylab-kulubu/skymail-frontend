import * as React from "react";
import { Context, Title, Paragraph, Rows, RowItem, RowsEnd, Cta } from "./theme";
import { Layout, Note, SITE, greeting, when } from "./forms-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "forms.status-changed",
  name: "Forms · Cevap Durumu",
  subject:
    "{{if eq .status `approved`}}{{if or .nextFormId .linkedFormId}}Sonraki adıma geçtiniz{{else}}Cevabınız onaylandı{{end}}{{else if eq .status `declined`}}Cevabınız kabul edilmedi{{else if eq .status `returned`}}Cevabınızda düzeltme istendi{{else if eq .status `reopened`}}Yeniden başvurabilirsiniz{{else}}Cevabınız incelendi{{end}} · {{.formTitle}}",
  system: true,
  // The team's review note is written about this person's application, for
  // them alone: a send's content is kept masked. No sensitiveVariables list.
  contentSensitive: true,
  brand: "forms",
  trigger:
    "forms-backend, ekip bir cevabı onayladığında (approved), reddettiğinde (declined) ya da düzeltme istediğinde (returned); akış adımındaysa sonraki adımın formu nextFormId ile gelir. Ekip bir başvuruyu kapatıp yeniden başvuruya açtığında da (reopened) akışın ilk formu nextFormId ile gelir (FormMailNotifier.NotifyStatusChangedAsync / NotifyRunReopenedAsync). Gövde forms-frontend mail-templates/StatusChanged.jsx. Bildirim türü kayıtlı (zorunlu, yalnız e-posta, system şeridi): core üyeye bu postayı POST /v1/notifications ile gönderecek (ADR-0075); Forms bugün /single ile gönderir.",
  // forms-backend FormMailNotifier: formTitle, status, reviewNote ("" when the
  // team left none) and firstName/recipientName (MailNames) always; reviewedAt,
  // nextFormId and questionCount (returned, the questions to fix) when set.
  // linkedFormId is the old two-form chaining's; Forms no longer sends it, the
  // body still falls back to it.
  variables: ["formTitle", "status", "reviewNote", "reviewedAt", "nextFormId", "questionCount", "firstName", "recipientName", "linkedFormId"],
  requiredVariables: [
    { name: "formTitle", reason: "Postanın hangi form için olduğunu söyleyen tek alan; kaldırılırsa posta formu adlandırmaz." },
    { name: "status", reason: "Onay, ret, düzeltme ve yeniden başvuru metinlerinden hangisinin gideceğini seçer; kaldırılırsa gövde boş gider." },
  ],
  // core sends this to a member with POST /v1/notifications (ADR-0075 karar
  // 5), which refuses a type SkyMail has no record of. By e-mail only for
  // now: an inbox text is its own change.
  notification: { category: null, required: true, defaultChannels: ["email"], lane: "system" },
  sample: {
    formTitle: "SKY LAB Yazılım Ekibi Başvurusu 2026",
    status: "approved",
    reviewNote: "Teknik mülakat için seni bekliyoruz, sonraki adımdaki formu doldurman yeterli.",
    reviewedAt: "04 Ekim 2026, 22:10",
    nextFormId: "8c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    questionCount: 2,
    firstName: "Ayşe",
    recipientName: "Ayşe Yılmaz",
    linkedFormId: "",
  },
};

const approved = (node: React.ReactNode) => when('eq .status `approved`', node);
const declined = (node: React.ReactNode) => when('eq .status `declined`', node);
const returned = (node: React.ReactNode) => when('eq .status `returned`', node);
const reopened = (node: React.ReactNode) => when('eq .status `reopened`', node);

export default function StatusChangedEmail() {
  return (
    <Layout
      preview="{{.formTitle}} {{if eq .status `approved`}}cevabınızı onayladık{{else if eq .status `returned`}}cevabınızda düzeltme istedik{{else if eq .status `reopened`}}için yeniden başvurabilirsiniz{{else}}cevabınızı inceledik{{end}}."
      reason="Bu e-postayı {{.formTitle}} {{if eq .status `reopened`}}başvurunuz{{else}}formunu doldurduğunuz{{end}} için aldınız."
    >
      {'{{$next := or .nextFormId .linkedFormId}}'}
      {approved(
        <>
          <Context tone="ok">{'{{.formTitle}}'}</Context>
          <Title>{'{{if $next}}'}Sonraki adıma geçtiniz{'{{else}}'}Cevabınız onaylandı{'{{end}}'}</Title>
          <Paragraph>
            {greeting} cevabınızı inceledik ve onayladık.
            {'{{if $next}}'} Başvurunuzun sonraki adımı açıldı, aşağıdan devam edebilirsiniz.{'{{end}}'}
          </Paragraph>
        </>
      )}
      {declined(
        <>
          <Context tone="neutral">{'{{.formTitle}}'}</Context>
          <Title>Cevabınız kabul edilmedi</Title>
          <Paragraph>{greeting} cevabınızı inceledik ama bu sefer olumlu dönemiyoruz. İlginiz için teşekkür ederiz.</Paragraph>
        </>
      )}
      {returned(
        <>
          <Context tone="brand">{'{{.formTitle}}'}</Context>
          <Title>Cevabınızda düzeltme istendi</Title>
          <Paragraph>
            {greeting} cevabınızı inceledik ve küçük bir düzeltme istiyoruz. Önceki cevaplarınız formda hazır; ekibin notuna göre düzenleyip yeniden gönderebilirsiniz.
          </Paragraph>
        </>
      )}
      {reopened(
        <>
          <Context tone="brand">{'{{.formTitle}}'}</Context>
          <Title>Yeniden başvurabilirsiniz</Title>
          <Paragraph>{greeting} ekip önceki başvurunuzu kapattı ve yeniden başvurmanıza izin verdi. Yeni başvurunuz ilk adımdan başlar.</Paragraph>
        </>
      )}

      {when('.reviewedAt', (
        <Rows>
          <RowItem label="{{if eq .status `reopened`}}Tarih{{else}}İnceleme tarihi{{end}}">{'{{.reviewedAt}}'}</RowItem>
          {when('.questionCount', <RowItem label="Düzeltilecek">{'{{.questionCount}} soru'}</RowItem>)}
          <RowsEnd />
        </Rows>
      ))}

      {'{{if .reviewNote}}'}
      <Note label="Ekibin notu">{'{{.reviewNote}}'}</Note>
      {'{{else}}'}
      <Note label="Ekibin notu" empty>Not bırakılmadı.</Note>
      {'{{end}}'}

      {approved(when('$next', <Cta href={SITE + '/{{$next}}'}>Sonraki adıma geç</Cta>))}
      {returned(when('$next', <Cta href={SITE + '/{{$next}}'}>Düzeltmeye git</Cta>))}
      {reopened(when('$next', <Cta href={SITE + '/{{$next}}'}>Başvuruya başla</Cta>))}
    </Layout>
  );
}
