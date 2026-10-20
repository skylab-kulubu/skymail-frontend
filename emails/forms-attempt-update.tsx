import * as React from "react";
import { Context, Title, Paragraph, Strong, Rows, RowItem, RowsEnd, Cta } from "./theme";
import { Layout, SITE, greeting, when, whenKind } from "./forms-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "forms.attempt-update",
  name: "Forms · Görev Güncellemesi",
  subject:
    "{{if eq .kind `reminder`}}Görevi henüz başlatmadınız{{else if eq .kind `extended`}}Sürenizi uzattık{{else if eq .kind `accepted`}}Tesliminiz kabul edildi{{else if eq .kind `closed`}}Tesliminiz kabul edilmedi{{else}}Süreniz doldu{{end}} · {{.formTitle}}",
  system: true,
  contentSensitive: false,
  brand: "forms",
  trigger:
    "forms-backend, süreli bir görevde (süre sınırlı form): görevi başlatmamış kişiye hatırlatma (reminder), ekip süreyi uzattığında (extended), süre dolduğunda cevap varsa (expired) ya da yoksa (expiredEmpty), süre dolduğunda kaydedilen cevap teslim olarak kabul edildiğinde (accepted) ya da edilmediğinde (closed) (FormMailNotifier.NotifyAttemptAsync, FormAttemptService). Gövde forms-frontend mail-templates/AttemptUpdate.jsx.",
  // forms-backend FormMailNotifier: formTitle, formId, kind and
  // firstName/recipientName (MailNames) always; deadlineAt, minutes with its
  // text duration ("1 saat 30 dakika"), and nextFormId when set. extended
  // always carries minutes; reminder carries the form's close time and time
  // limit when the form has them.
  variables: ["formTitle", "formId", "kind", "deadlineAt", "minutes", "duration", "nextFormId", "firstName", "recipientName"],
  requiredVariables: [
    { name: "formTitle", reason: "Postanın hangi formdaki görev için olduğunu söyleyen tek alan; kaldırılırsa posta görevi adlandırmaz." },
    { name: "formId", reason: "Göreve ve durumuna giden bağlantının adresi; kaldırılırsa kişi göreve ulaşamaz." },
    { name: "kind", reason: "Hatırlatma, uzatma, süre bitimi ve teslim sonucu metinlerinden hangisinin gideceğini seçer; kaldırılırsa gövde boş gider." },
  ],
  sample: {
    formTitle: "SKY LAB Yazılım Ekibi Teknik Görevi",
    formId: "8c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    kind: "extended",
    deadlineAt: "06 Ekim 2026, 18:00",
    minutes: 90,
    duration: "1 saat 30 dakika",
    nextFormId: "",
    firstName: "Ayşe",
    recipientName: "Ayşe Yılmaz",
  },
};

const form = SITE + '/{{.formId}}';
const status = <Cta href={form}>Durumu gör</Cta>;
const nextOrStatus = (
  <>
    {'{{if .nextFormId}}'}
    <Cta href={SITE + '/{{.nextFormId}}'}>Sonraki adıma geç</Cta>
    {'{{else}}'}
    {status}
    {'{{end}}'}
  </>
);
const duration = '{{if .duration}}{{.duration}}{{else}}{{.minutes}} dakika{{end}}';

const PREVIEW = [
  '{{if eq .kind `reminder`}}Süre, görevi başlattığınız anda işlemeye başlıyor.',
  '{{else if eq .kind `extended`}}{{.formTitle}} formundaki görev için size ' + duration + ' daha verdik.',
  '{{else if eq .kind `expired`}}O ana kadar girdiğiniz cevaplar bize ulaştı.',
  '{{else if eq .kind `expiredEmpty`}}Süre bittiğinde hiç cevap girilmemişti.',
  '{{else if eq .kind `accepted`}}Süre dolduğunda kaydedilen cevaplarınızı teslim olarak kabul ettik.',
  '{{else if eq .kind `closed`}}Süre dolduğunda kaydedilen cevaplarınızı teslim olarak kabul edemiyoruz.',
  '{{end}}',
].join('');

export default function AttemptUpdateEmail() {
  return (
    <Layout preview={PREVIEW} reason="Bu e-postayı {{.formTitle}} formundaki göreve katıldığınız için aldınız.">
      {whenKind('reminder', (
        <>
          <Context tone="wait">{'{{.formTitle}}'}</Context>
          <Title>Görevi henüz başlatmadınız</Title>
          <Paragraph>
            {greeting} <Strong>{'{{.formTitle}}'}</Strong> formundaki görevi henüz başlatmadığınızı hatırlatmak istedik. Süre, görevi başlattığınız anda işlemeye başlıyor; müsait olduğunuz bir zamanda başlatabilirsiniz.
          </Paragraph>
          <Rows>
            {when('.duration', <RowItem label="Görev süresi">{'{{.duration}}'}</RowItem>)}
            {when('.deadlineAt', <RowItem label="Son başlama">{'{{.deadlineAt}}'}</RowItem>)}
            <RowsEnd />
          </Rows>
          <Cta href={form}>Göreve git</Cta>
        </>
      ))}

      {whenKind('extended', (
        <>
          <Context tone="brand">{'{{.formTitle}}'}</Context>
          <Title>Sürenizi uzattık</Title>
          <Paragraph>{greeting} <Strong>{'{{.formTitle}}'}</Strong> formundaki görev için size {duration} daha verdik. Kaldığınız yerden devam edebilirsiniz.</Paragraph>
          {when('.deadlineAt', (
            <Rows>
              <RowItem label="Yeni bitiş">{'{{.deadlineAt}}'}</RowItem>
              <RowsEnd />
            </Rows>
          ))}
          <Cta href={form}>Göreve dön</Cta>
        </>
      ))}

      {whenKind('expired', (
        <>
          <Context tone="wait">{'{{.formTitle}}'}</Context>
          <Title>Süreniz doldu</Title>
          <Paragraph>{greeting} <Strong>{'{{.formTitle}}'}</Strong> formundaki görevin süresi doldu. O ana kadar girdiğiniz cevaplar bize ulaştı; inceledikten sonra size e-postayla döneceğiz.</Paragraph>
          {when('.deadlineAt', (
            <Rows>
              <RowItem label="Bitiş">{'{{.deadlineAt}}'}</RowItem>
              <RowsEnd />
            </Rows>
          ))}
          {status}
        </>
      ))}

      {whenKind('expiredEmpty', (
        <>
          <Context tone="neutral">{'{{.formTitle}}'}</Context>
          <Title>Süreniz doldu</Title>
          <Paragraph>
            {greeting} <Strong>{'{{.formTitle}}'}</Strong> formundaki görevin süresi doldu. Süre bittiğinde hiç cevap girilmemişti, bu yüzden bir teslim kaydedemedik.
            {'{{if .nextFormId}}'} Başvurunuz sonraki adımla devam ediyor.{'{{else}}'} Gerekirse size ek süre verebiliriz; öyle olursa e-postayla haber veririz.{'{{end}}'}
          </Paragraph>
          {when('.deadlineAt', (
            <Rows>
              <RowItem label="Bitiş">{'{{.deadlineAt}}'}</RowItem>
              <RowsEnd />
            </Rows>
          ))}
          {nextOrStatus}
        </>
      ))}

      {whenKind('accepted', (
        <>
          <Context tone="ok">{'{{.formTitle}}'}</Context>
          <Title>Tesliminiz kabul edildi</Title>
          <Paragraph>
            {greeting} süre dolduğunda kaydedilen cevaplarınızı inceledik ve teslim olarak kabul ettik.
            {'{{if .nextFormId}}'} Başvurunuzun sonraki adımı açıldı, aşağıdan devam edebilirsiniz.{'{{end}}'}
          </Paragraph>
          {nextOrStatus}
        </>
      ))}

      {whenKind('closed', (
        <>
          <Context tone="bad">{'{{.formTitle}}'}</Context>
          <Title>Tesliminiz kabul edilmedi</Title>
          <Paragraph>
            {greeting} süre dolduğunda kaydedilen cevaplarınızı inceledik ama maalesef teslim olarak kabul edemiyoruz.
            {'{{if .nextFormId}}'} Başvurunuz sonraki adımla devam ediyor.{'{{end}}'}
          </Paragraph>
          {nextOrStatus}
        </>
      ))}
    </Layout>
  );
}
