import * as React from "react";
import { Text } from "@react-email/components";
import { Cta, DetailRow, Heading, Note, Paragraph, Shell, colors, fontStack } from "./theme";
import { v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.primary-email-changed",
  name: "Birincil E-posta Değişti (eski adrese)",
  subject: "SKY LAB hesabının e-posta adresi değişti",
  system: true,
  brand: "account",
  trigger:
    "Account center, birincil e-posta değiştiğinde — ESKİ adrese gider. Yeni adres zaten doğrulama postası aldığı için bu, değişikliği kaçıran kişiye tek uyarıdır.",
  variables: ["OldEmail", "NewEmail", "OccurredAt", "SecureAccountUrl"],
  sample: {
    OldEmail: "yusuf@std.yildiz.edu.tr",
    NewEmail: "yusuf@yildizskylab.com",
    OccurredAt: "22.09.2026 16:20",
    SecureAccountUrl: "https://my.yildizskylab.com/guvenlik",
  },
};

/**
 * Sent to the address being replaced, not the new one. If someone else took
 * over the account, this is the last mail the real owner will receive there —
 * so it leads with what changed and how to stop it.
 */
export default function AccountPrimaryEmailChanged() {
  return (
    <Shell preview="SKY LAB hesabının birincil e-posta adresi değiştirildi." brand="account">
      <Heading>Hesabının E-posta Adresi Değişti</Heading>

      <Paragraph>
        SKY LAB hesabının birincil e-posta adresi değiştirildi. Bundan sonra hesapla ilgili bildirimler yeni adrese
        gidecek; bu, bu adrese gönderdiğimiz son bildirim.
      </Paragraph>

      <div style={{ marginTop: "24px" }}>
        <DetailRow label="Eski adres" value={v("OldEmail")} />
        <DetailRow label="Yeni adres" value={v("NewEmail")} />
        <DetailRow label="Tarih" value={v("OccurredAt")} last />
      </div>

      <div style={{ marginTop: "28px" }}>
        <Note tone="alert">
          Bu değişikliği sen yapmadıysan vakit kaybetmeden hesabına eriş, parolanı değiştir ve açık oturumları kapat.
          Hesabına giremiyorsan info@yildizskylab.com adresine bu e-postayı ileterek bize yaz.
        </Note>
      </div>

      <Cta href={v("SecureAccountUrl")}>Hesabımı Güvene Al</Cta>

      <Text
        className="t-faint"
        style={{ marginTop: "24px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Okul e-posta adresin YTÜ bağlantısından geldiği için değiştirilemez; değişen, bildirimlerin gittiği birincil adrestir.
      </Text>
    </Shell>
  );
}
