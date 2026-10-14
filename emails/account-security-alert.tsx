import * as React from "react";
import { Context, Cta, Note, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.security-alert",
  name: "Hesap Güvenlik Bildirimi",
  // EventTitle is the whole point of this template, so the sender always has
  // it; no other variable belongs in the subject.
  subject: `SKY LAB hesabında: ${v("EventTitle")}`,
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "Account center / sky-account SPI, hesapta güvenlikle ilgili bir şey değiştiğinde: parola değişti, geçiş anahtarı eklendi/silindi, doğrulama uygulaması eklendi/kaldırıldı, yeni cihazdan giriş, tüm oturumlar kapatıldı, kullanıcı adı değişti, kişisel e-posta eklendi/kaldırıldı.",
  variables: ["EventTitle", "EventDetail", "OccurredAt", "DeviceLabel", "IpAddress", "Location", "SecureAccountUrl"],
  sensitiveVariables: ["SecureAccountUrl"],
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
    <Shell
      preview={`SKY LAB hesabında: ${v("EventTitle")}`}
      brand="account"
      reason="Bu bildirimi, hesabında güvenlikle ilgili bir değişiklik olduğu için alıyorsun; bu postaların gönderimi kapatılamaz."
    >
      <Context tone="wait">
        Hesap güvenliği{ifSet("OccurredAt")} · {v("OccurredAt")}{end}
      </Context>
      <Title>{v("EventTitle")}</Title>

      <Paragraph>{v("EventDetail")}</Paragraph>

      {ifSet("DeviceLabel")}
      <Rows>
        <RowItem label="Cihaz">{v("DeviceLabel")}</RowItem>
        {ifSet("Location")}
        <RowItem label="Konum">{v("Location")}</RowItem>
        {end}
        {ifSet("IpAddress")}
        <RowItem label="IP adresi">{v("IpAddress")}</RowItem>
        {end}
        <RowsEnd />
      </Rows>
      {end}

      <Note tone="alert">
        Bu işlemi sen yapmadıysan hesabın risk altında olabilir. Hemen parolanı değiştir ve açık oturumları kapat.
      </Note>

      <Cta href={v("SecureAccountUrl")}>Hesabımı Güvene Al</Cta>

      {/* About the rows above, so it stays in the body rather than the footer. */}
      <Small style={{ marginTop: "24px" }}>Konum ve IP bilgisi yaklaşıktır.</Small>
    </Shell>
  );
}
