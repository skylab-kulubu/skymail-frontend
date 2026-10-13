import * as React from "react";
import { CodeBlock, Context, Cta, Label, Paragraph, RowItem, Rows, RowsEnd, Shell, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "ops.send-failed",
  name: "Operasyon · Gönderim Hatası",
  subject: "SkyMail gönderiminde hata",
  system: false,
  contentSensitive: false,
  brand: "mail",
  trigger:
    "SkyMail, bir görevdeki mailler yeniden denemeler bittikten sonra da gönderilemediğinde, gönderimi başlatan kişiye. NOT: bu uyarıyı gönderen kod henüz yazılmadı.",
  variables: ["TaskId", "TemplateName", "FailedCount", "TotalCount", "FirstError", "TaskUrl"],
  sample: {
    TaskId: "6f3d2c61-8a1e-4f5b-9f21-2b7c4de90a13",
    TemplateName: "GECEKODU Duyurusu",
    FailedCount: "7",
    TotalCount: "312",
    FirstError: "dial tcp 10.0.1.25:587: i/o timeout",
    TaskUrl: "https://mail.yildizskylab.com/mail_tasks/6f3d2c61-8a1e-4f5b-9f21-2b7c4de90a13",
  },
};

/**
 * An operator mail, not a member mail: it leads with the numbers and keeps the
 * raw SMTP error, because whoever reads this is going to paste it somewhere.
 */
export default function OpsSendFailed() {
  return (
    <Shell
      preview="Bir SkyMail gönderiminde başarısız olan alıcılar var."
      brand="mail"
      reason="Bu e-postayı, bu gönderimi sen başlattığın için alıyorsun."
    >
      <Context tone="bad">
        {v("FailedCount")} / {v("TotalCount")} başarısız
      </Context>
      <Title>Gönderimde Hata</Title>

      <Paragraph>
        Başlattığın gönderimde bazı mailler yeniden denemelerden sonra da iletilemedi. Başarılı olanlar gitti;
        aşağıdaki sayı yalnızca iletilemeyenleri gösteriyor.
      </Paragraph>

      <Rows>
        <RowItem label="Şablon">{v("TemplateName")}</RowItem>
        <RowItem label="Görev">{v("TaskId")}</RowItem>
        <RowsEnd />
      </Rows>

      {ifSet("FirstError")}
      <div style={{ marginTop: "24px" }}>
        <Label>İlk Hata</Label>
        <CodeBlock size={12}>{v("FirstError")}</CodeBlock>
      </div>
      {end}

      {ifSet("TaskUrl")}
      <Cta href={v("TaskUrl")}>Kuyruğu İncele</Cta>
      {end}
    </Shell>
  );
}
