import * as React from "react";
import { Text } from "@react-email/components";
import { Cta, DetailRow, Heading, Label, Paragraph, Shell, Strong, colors, fontStack } from "./theme";
import { v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.welcome",
  name: "Hoş Geldin",
  subject: "SKY LAB ekosistemine hoş geldin",
  system: true,
  brand: "skylab",
  trigger: "core-backend, yeni bir User ilk kez göründüğünde (SKYMAIL_WELCOME_TEMPLATE_ID).",
  // core-backend/internal/mail/mail.go gönderdiği set budur. Username YOK —
  // eski şablon {{.Username}} kullandığı için canlıda "Selam ." yazıyordu.
  variables: ["FirstName", "LastName", "Email", "SkyNumber", "CreatedAt"],
  // Nothing: the mail welcomes without an action, and every fact in it is also in Account center.
  requiredVariables: [],
  sample: {
    FirstName: "Yusuf",
    LastName: "Durusoy",
    Email: "yusuf@yildizskylab.com",
    SkyNumber: "SKY-0042",
    CreatedAt: "22.09.2026",
  },
};

export default function CoreWelcome() {
  return (
    <Shell preview="SKY LAB ekosistemine kaydın tamamlandı — Sky Number'ın hazır." brand="skylab">
      <Heading>Aramıza Hoş Geldin</Heading>

      <Paragraph>
        Merhaba {v("FirstName")}, SKY LAB ekosistemine kaydın tamamlandı. Aşağıda kimliğin ve atabileceğin ilk adımlar var.
      </Paragraph>

      <div style={{ marginTop: "28px" }}>
        <Label>Sky Number</Label>
        <Text
          className="t-primary"
          style={{
            margin: "8px 0 0",
            fontSize: "36px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            lineHeight: "1.1",
            color: colors.skylab900,
            fontFamily: fontStack,
          }}
        >
          {v("SkyNumber")}
        </Text>
        <Text
          className="t-faint"
          style={{ margin: "8px 0 0", fontSize: "12px", letterSpacing: "0.05em", color: colors.textFaint, fontFamily: fontStack }}
        >
          Kalıcı · değişmez · sana ait
        </Text>
      </div>

      <div style={{ marginTop: "28px" }}>
        <DetailRow label="Ad Soyad" value={`${v("FirstName")} ${v("LastName")}`} />
        <DetailRow label="E-posta" value={v("Email")} />
        <DetailRow label="Katılım" value={v("CreatedAt")} last />
      </div>

      <Paragraph style={{ marginTop: "28px" }}>
        Etkinliklerimizi, projelerimizi ve başvuruları <Strong>yildizskylab.com</Strong> üzerinden takip edebilirsin.
        Hesabınla ilgili her şeyi (parola, geçiş anahtarı, e-posta adreslerin) <Strong>my.yildizskylab.com</Strong>
        {" "}adresinden kendin yönetirsin.
      </Paragraph>

      <Cta href="https://yildizskylab.com">Ekosisteme Göz At</Cta>

      <Text
        className="t-faint"
        style={{ marginTop: "28px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.
      </Text>
    </Shell>
  );
}
