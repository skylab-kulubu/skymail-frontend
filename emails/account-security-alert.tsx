import * as React from "react";
import { Text } from "@react-email/components";
import { Chip, Cta, DetailRow, Heading, Note, Paragraph, Shell, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.security-alert",
  name: "Hesap Güvenlik Bildirimi",
  // EventTitle is the whole point of this template, so the sender always has
  // it; no other variable belongs in the subject.
  subject: `SKY LAB hesabında: ${v("EventTitle")}`,
  system: true,
  brand: "account",
  trigger:
    "Account center / sky-account SPI, hesapta güvenlikle ilgili bir şey değiştiğinde: parola değişti, geçiş anahtarı eklendi/silindi, doğrulama uygulaması eklendi/kaldırıldı, yeni cihazdan giriş, tüm oturumlar kapatıldı, kullanıcı adı değişti, kişisel e-posta eklendi/kaldırıldı.",
  variables: ["EventTitle", "EventDetail", "OccurredAt", "DeviceLabel", "IpAddress", "Location", "SecureAccountUrl"],
  // Nothing yet: no service sends it. Its sender declares the contract (SecureAccountUrl, likely).
  requiredVariables: [],
  sample: {
    EventTitle: "Yeni geçiş anahtarı eklendi",
    EventDetail: "Hesabına \"MacBook Pro\" adlı yeni bir geçiş anahtarı (passkey) eklendi. Artık bu cihazla parolasız giriş yapabilirsin.",
    OccurredAt: "22.09.2026 16:04",
    DeviceLabel: "macOS · Safari",
    IpAddress: "88.230.14.7",
    Location: "İstanbul, TR",
    SecureAccountUrl: "https://my.yildizskylab.com/guvenlik",
  },
};

/**
 * One template for every security event rather than one per event.
 *
 * The events differ only in a title and a sentence; what has to be identical is
 * the part that matters — the "this was not me" path. Eight near-copies would
 * drift, and the one that drifted would be the one someone needed at 3am.
 */
export default function AccountSecurityAlert() {
  return (
    <Shell preview={`SKY LAB hesabında: ${v("EventTitle")}`} brand="account">
      <Heading>{v("EventTitle")}</Heading>

      {ifSet("OccurredAt")}
      <Chip>{v("OccurredAt")}</Chip>
      {end}

      <Paragraph style={{ marginTop: "18px" }}>{v("EventDetail")}</Paragraph>

      {ifSet("DeviceLabel")}
      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Cihaz" value={v("DeviceLabel")} />
        {ifSet("Location")}
        <DetailRow label="Konum" value={v("Location")} />
        {end}
        {ifSet("IpAddress")}
        <DetailRow label="IP adresi" value={v("IpAddress")} last />
        {end}
      </div>
      {end}

      <div style={{ marginTop: "28px" }}>
        <Note tone="alert">
          Bu işlemi sen yapmadıysan hesabın risk altında olabilir. Hemen parolanı değiştir ve açık oturumları kapat.
        </Note>
      </div>

      <Cta href={v("SecureAccountUrl")}>Hesabımı Güvene Al</Cta>

      <Text
        className="t-faint"
        style={{ marginTop: "24px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Bu bildirimi, hesabında güvenlikle ilgili bir değişiklik olduğu için alıyorsun; bu postaların gönderimi
        kapatılamaz. Konum ve IP bilgisi yaklaşıktır.
      </Text>
    </Shell>
  );
}
