import * as React from "react";
import { Context, Title, Paragraph, Rows, RowItem, RowsEnd, ListHeader, colors } from "./theme";
import { Layout, greeting } from "./forms-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "forms.form-copy",
  name: "Forms · Yanıt Alındı",
  subject: "Cevabınızı aldık · {{.formTitle}}",
  system: true,
  // The person's own answers (a phone or student number among them) are what
  // the recipient alone should see: a send's content is kept masked. No
  // sensitiveVariables list; SkyMail masks by name and shape.
  contentSensitive: true,
  brand: "forms",
  trigger:
    "forms-backend, bir form gönderildiğinde gönderen kişiye cevaplarının kopyası; doğrulanmamış misafir adresine form başına bir kopya ve günde en çok FormMail:GuestCopyDailyLimit (FormMailNotifier.NotifyResponseCopyAsync). Gövde forms-frontend mail-templates/FormSubmission.jsx. Bildirim türü kayıtlı (zorunlu, yalnız e-posta, system şeridi): core üyeye bu postayı POST /v1/notifications ile gönderecek (ADR-0075); Forms bugün /single ile gönderir.",
  // forms-backend FormMailNotifier.NotifyResponseCopyAsync: formTitle,
  // submittedAt ("dd MMMM yyyy, HH:mm", tr-TR), answers (one { question,
  // answer } per question, answer null when left empty) and
  // firstName/recipientName (MailNames), always.
  variables: ["formTitle", "submittedAt", "answers", "firstName", "recipientName"],
  requiredVariables: [
    { name: "formTitle", reason: "Postanın hangi form için olduğunu söyleyen tek alan; kaldırılırsa posta formu adlandırmaz." },
    { name: "answers", reason: "Gönderilen cevapların kopyası; kaldırılırsa posta kopyayı taşımaz." },
  ],
  // core sends this to a member with POST /v1/notifications (ADR-0075 karar
  // 5), which refuses a type SkyMail has no record of. By e-mail only for
  // now: an inbox text is its own change.
  notification: { category: null, required: true, defaultChannels: ["email"], lane: "system" },
  sample: {
    formTitle: "SKY LAB Yazılım Ekibi Başvurusu 2026",
    submittedAt: "04 Ekim 2026, 22:10",
    answers: [
      { question: "Hangi ekipte çalışmak istersiniz?", answer: "Backend" },
      { question: "Neden bu ekip?", answer: "Go ile servis yazmayı seviyorum.\nGeçen yıl kulübün etkinlik sitesine katkı verdim." },
      { question: "GitHub profiliniz", answer: null },
    ],
    firstName: "Ayşe",
    recipientName: "Ayşe Yılmaz",
  },
};

export default function FormSubmissionEmail() {
  return (
    <Layout
      preview="Gönderdiğiniz cevapların bir kopyası bu e-postada."
      reason="Bu e-postayı {{.formTitle}} formunu doldurduğunuz için aldınız."
    >
      <Context tone="ok">{'{{.formTitle}}'}</Context>
      <Title>Cevabınızı aldık</Title>
      <Paragraph>{greeting} cevabınız bize ulaştı. Gönderdiklerinizin bir kopyasını aşağıya ekledik.</Paragraph>

      <Rows>
        <RowItem label="Gönderim tarihi">{'{{.submittedAt}}'}</RowItem>
        <RowsEnd />
      </Rows>

      <ListHeader title="Cevaplarınız" count="{{len .answers}} soru" />
      <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {'{{range $index, $answer := .answers}}'}
          <tr>
            <td className="hair" style={{ borderTop: `1px solid ${colors.hair}`, padding: '14px 0' }}>
              <p className="t-muted" style={{ margin: 0, fontSize: '13px', lineHeight: '20px', color: colors.muted }}>
                <span className="t-link" style={{ color: colors.link, fontWeight: 500, paddingRight: '8px', fontVariantNumeric: 'tabular-nums' }}>{'{{printf `%02d` (add1 $index)}}'}</span>
                {'{{.question}}'}
              </p>
              <p className="t-primary" style={{ margin: '4px 0 0', fontSize: '15px', lineHeight: '24px', color: colors.primary, whiteSpace: 'pre-wrap' }}>
                {'{{if .answer}}{{.answer}}{{else}}'}
                <span className="t-faint" style={{ color: colors.faint, fontStyle: 'italic' }}>Boş bırakıldı</span>
                {'{{end}}'}
              </p>
            </td>
          </tr>
          {'{{end}}'}
        </tbody>
      </table>
    </Layout>
  );
}
