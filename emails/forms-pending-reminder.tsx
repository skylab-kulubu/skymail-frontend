import * as React from "react";
import { Context, Title, Paragraph, ListHeader, Cta, colors, tones } from "./theme";
import { Layout, SITE, greeting } from "./forms-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "forms.pending-reminder",
  name: "Forms · Bekleyen Cevaplar",
  subject: "İncelemeni bekleyen {{.totalPending}} cevap var",
  system: true,
  contentSensitive: false,
  brand: "forms",
  trigger:
    "forms-backend, ReminderThresholdHours'tan uzun süredir bekleyen cevabı olan formların her inceleyicisine, formları tek listede; tarama ReminderScanIntervalMinutes'ta bir koşar ve bir cevap için bir kez hatırlatır (PendingResponseReminderWorker). Gövde forms-frontend mail-templates/PendingResponses.jsx.",
  // forms-backend PendingResponseReminderWorker: totalPending, forms (one
  // { formId, formTitle, pendingCount } per form the reviewer reviews) and
  // firstName/recipientName (MailNames), always.
  variables: ["totalPending", "forms", "firstName", "recipientName"],
  requiredVariables: [
    { name: "totalPending", reason: "Bekleyen cevapların sayısı; konu ve başlık onu söyler, kaldırılırsa posta kaç cevap beklediğini söylemez." },
    { name: "forms", reason: "Bekleyen cevabı olan formlar ve cevap sayfalarının bağlantısı; kaldırılırsa posta hangi formların beklediğini söylemez." },
  ],
  sample: {
    totalPending: 7,
    forms: [
      { formId: "8c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f", formTitle: "SKY LAB Yazılım Ekibi Başvurusu 2026", pendingCount: 5 },
      { formId: "3f2a9c1e-7b4d-4e8a-9f61-2c5d8e0a4b17", formTitle: "GECEKODU 2026 Gönüllü Formu", pendingCount: 2 },
    ],
    firstName: "Ayşe",
    recipientName: "Ayşe Yılmaz",
  },
};

export default function PendingResponsesEmail() {
  return (
    <Layout
      preview="İnceleyici olduğun formlarda bekleyen cevaplar var."
      reason="Bu e-postayı, inceleyici olduğun formlarda bekleyen cevaplar olduğu için aldın."
    >
      <Context tone="wait">Bekleyen cevaplar</Context>
      <Title>İncelemeni bekleyen {'{{.totalPending}}'} cevap var</Title>
      <Paragraph>{greeting} inceleyici olduğun formlarda bir süredir bekleyen cevaplar var. Formun adına tıklarsan doğrudan cevaplar sayfası açılır.</Paragraph>

      <ListHeader title="Formlar" count="{{len .forms}} form" />
      <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {'{{range .forms}}'}
          <tr>
            <td className="hair" style={{ borderTop: `1px solid ${colors.hair}`, padding: '12px 0' }}>
              <a href={SITE + '/admin/forms/{{.formId}}/responses'} className="t-primary" style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 500, color: colors.primary, textDecoration: 'none' }}>
                {'{{.formTitle}}'}
              </a>
              {/* The trailing spaces here and after "bekliyor" do not show in the cells; in the plain text they keep a form's address off its count ("…/responses 5 bekliyor", not "…/responses5") and a row off the next. */}
              {' '}
            </td>
            <td className="hair tone-wait" align="right" style={{ borderTop: `1px solid ${colors.hair}`, padding: '12px 0 12px 16px', fontSize: '13px', lineHeight: '20px', color: tones.wait, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {'{{.pendingCount}}'} bekliyor{' '}
            </td>
          </tr>
          {'{{end}}'}
          <tr>
            <td colSpan={2} className="hair" style={{ borderTop: `1px solid ${colors.hair}`, fontSize: 0, lineHeight: 0, height: '1px' }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      <Cta href={SITE + '/admin/forms'}>Panele git</Cta>
    </Layout>
  );
}
