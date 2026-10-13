import * as React from "react";
import { Context, Cta, Note, Paragraph, Shell, Small, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.deletion-requested",
  name: "Hesap Silme Talebi Alındı",
  subject: "Hesap silme talebini aldık",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "Account center, kişi hesabını sildiğinde. Erişim anında kapanır, kişisel veriler sonra anonimleştirilir (ADR-0042). ACCOUNT_ERASURE_MODE açıldığında devreye girer.",
  variables: ["RequestedAt", "CompletesAt", "CancelUrl"],
  // Nothing yet: no service sends it. Its sender declares the contract (CancelUrl, likely).
  requiredVariables: [],
  sample: {
    RequestedAt: "22.09.2026 16:30",
    CompletesAt: "29.09.2026",
    CancelUrl: "https://my.yildizskylab.com/silme-talebi/iptal?token=ornek",
  },
};

export default function AccountDeletionRequested() {
  return (
    <Shell
      preview="SKY LAB hesabının silinmesi için talebini aldık."
      brand="account"
      reason="Bu e-postayı, SKY LAB hesabının silinmesi istendiği için alıyorsun."
    >
      <Context tone="wait">
        Hesap silme{ifSet("RequestedAt")} · {v("RequestedAt")}{end}
      </Context>
      <Title>Silme Talebini Aldık</Title>

      <Paragraph>
        SKY LAB hesabının silinmesi için talebini aldık. Hesabına erişimin şu andan itibaren kapalı. Kişisel bilgilerin{" "}
        {ifSet("CompletesAt")}<Strong>{v("CompletesAt")}</Strong> tarihine kadar {end}
        sistemlerimizden kaldırılacak.
      </Paragraph>

      <Paragraph>
        Katılım geçmişin ve daha önce aldığın sertifikalar, doğrulanabilir kalmaları için kimliğinden koparılarak
        saklanır — yani sertifikanı gösterdiğin kişi onu doğrulamaya devam edebilir, ama sertifika artık seni işaret etmez.
      </Paragraph>

      {ifSet("CancelUrl")}
      <Note>Fikrini değiştirdiysen silme tamamlanmadan önce talebi geri alabilirsin.</Note>
      <Cta href={v("CancelUrl")}>Silme Talebimi Geri Al</Cta>
      {end}

      <Small style={{ marginTop: "24px" }}>
        Bu talebi sen yapmadıysan hemen info@yildizskylab.com adresine yaz — silme tamamlanmadan durdurabiliriz.
      </Small>
    </Shell>
  );
}
