import * as React from "react";
import { Text } from "@react-email/components";
import { Chip, Cta, Heading, Note, Paragraph, Shell, Strong, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.deletion-requested",
  name: "Hesap Silme Talebi Alındı",
  subject: "Hesap silme talebini aldık",
  system: true,
  brand: "account",
  trigger:
    "Account center, kişi hesabını sildiğinde. Erişim anında kapanır, kişisel veriler sonra anonimleştirilir (ADR-0042). ACCOUNT_ERASURE_MODE açıldığında devreye girer.",
  variables: ["RequestedAt", "CompletesAt", "CancelUrl"],
  sample: {
    RequestedAt: "22.09.2026 16:30",
    CompletesAt: "29.09.2026",
    CancelUrl: "https://my.yildizskylab.com/silme-talebi/iptal?token=ornek",
  },
};

export default function AccountDeletionRequested() {
  return (
    <Shell preview="SKY LAB hesabının silinmesi için talebini aldık." brand="account">
      <Heading>Silme Talebini Aldık</Heading>

      {ifSet("RequestedAt")}
      <Chip>{v("RequestedAt")}</Chip>
      {end}

      <Paragraph style={{ marginTop: "18px" }}>
        SKY LAB hesabının silinmesi için talebini aldık. Hesabına erişimin şu andan itibaren kapalı. Kişisel bilgilerin{" "}
        {ifSet("CompletesAt")}<Strong>{v("CompletesAt")}</Strong> tarihine kadar {end}
        sistemlerimizden kaldırılacak.
      </Paragraph>

      <Paragraph>
        Katılım geçmişin ve daha önce aldığın sertifikalar, doğrulanabilir kalmaları için kimliğinden koparılarak
        saklanır — yani sertifikanı gösterdiğin kişi onu doğrulamaya devam edebilir, ama sertifika artık seni işaret etmez.
      </Paragraph>

      {ifSet("CancelUrl")}
      <div style={{ marginTop: "28px" }}>
        <Note>Fikrini değiştirdiysen silme tamamlanmadan önce talebi geri alabilirsin.</Note>
      </div>
      <Cta href={v("CancelUrl")}>Silme Talebimi Geri Al</Cta>
      {end}

      <Text
        className="t-faint"
        style={{ marginTop: "24px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Bu talebi sen yapmadıysan hemen info@yildizskylab.com adresine yaz — silme tamamlanmadan durdurabiliriz.
      </Text>
    </Shell>
  );
}
