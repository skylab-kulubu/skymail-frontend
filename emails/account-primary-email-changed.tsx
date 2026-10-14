import * as React from "react";
import { Context, Cta, Note, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, Title } from "./theme";
import { v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.primary-email-changed",
  name: "Birincil E-posta Değişti (eski adrese)",
  subject: "SKY LAB hesabının e-posta adresi değişti",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "Account center, birincil e-posta değiştiğinde — ESKİ adrese gider. Yeni adres zaten doğrulama postası aldığı için bu, değişikliği kaçıran kişiye tek uyarıdır.",
  variables: ["OldEmail", "NewEmail", "OccurredAt", "SecureAccountUrl"],
  sensitiveVariables: ["SecureAccountUrl"],
  // Nothing yet: no service sends it. Its sender declares the contract (SecureAccountUrl, likely).
  requiredVariables: [],
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
    <Shell
      preview="SKY LAB hesabının birincil e-posta adresi değiştirildi."
      brand="account"
      reason="Bu e-postayı, bu adres SKY LAB hesabının önceki birincil adresi olduğu için alıyorsun."
    >
      <Context tone="wait">Hesap güvenliği</Context>
      <Title>Hesabının E-posta Adresi Değişti</Title>

      <Paragraph>
        SKY LAB hesabının birincil e-posta adresi değiştirildi. Bundan sonra hesapla ilgili bildirimler yeni adrese
        gidecek; bu, bu adrese gönderdiğimiz son bildirim.
      </Paragraph>

      <Rows>
        <RowItem label="Eski adres">{v("OldEmail")}</RowItem>
        <RowItem label="Yeni adres">{v("NewEmail")}</RowItem>
        <RowItem label="Tarih">{v("OccurredAt")}</RowItem>
        <RowsEnd />
      </Rows>

      <Note tone="alert">
        Bu değişikliği sen yapmadıysan vakit kaybetmeden hesabına eriş, parolanı değiştir ve açık oturumları kapat.
        Hesabına giremiyorsan info@yildizskylab.com adresine bu e-postayı ileterek bize yaz.
      </Note>

      <Cta href={v("SecureAccountUrl")}>Hesabımı Güvene Al</Cta>

      <Small style={{ marginTop: "24px" }}>
        Okul e-posta adresin YTÜ bağlantısından geldiği için değiştirilemez; değişen, bildirimlerin gittiği birincil adrestir.
      </Small>
    </Shell>
  );
}
