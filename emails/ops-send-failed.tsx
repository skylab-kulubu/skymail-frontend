import * as React from "react";
import { Text } from "@react-email/components";
import { Chip, Cta, DetailRow, Heading, Label, Paragraph, Shell, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "ops.send-failed",
  name: "Operasyon · Gönderim Hatası",
  subject: "SkyMail gönderiminde hata",
  system: false,
  brand: "skylab",
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
    <Shell preview="Bir SkyMail gönderiminde başarısız olan alıcılar var." brand="skylab">
      <Heading>Gönderimde Hata</Heading>

      <Chip tone="alert">
        {v("FailedCount")} / {v("TotalCount")} başarısız
      </Chip>

      <Paragraph style={{ marginTop: "18px" }}>
        Başlattığın gönderimde bazı mailler yeniden denemelerden sonra da iletilemedi. Başarılı olanlar gitti;
        aşağıdaki sayı yalnızca iletilemeyenleri gösteriyor.
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Şablon" value={v("TemplateName")} />
        <DetailRow label="Görev" value={v("TaskId")} last />
      </div>

      {ifSet("FirstError")}
      <div style={{ marginTop: "24px" }}>
        <Label>İlk Hata</Label>
        <Text
          className="code-block"
          style={{
            margin: "6px 0 0",
            padding: "10px 14px",
            borderRadius: "8px",
            border: `1px solid ${colors.cardBorder}`,
            backgroundColor: "rgba(143,94,152,0.06)",
            fontSize: "12px",
            lineHeight: "1.6",
            color: colors.textBody,
            fontFamily: "'SF Mono', Menlo, Consolas, monospace",
            wordBreak: "break-all",
          }}
        >
          {v("FirstError")}
        </Text>
      </div>
      {end}

      {ifSet("TaskUrl")}
      <Cta href={v("TaskUrl")}>Kuyruğu İncele</Cta>
      {end}
    </Shell>
  );
}
