import * as React from "react";
import { Context, Paragraph, Shell, Small, Strong, Title } from "./theme";
import { v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.deletion-requested",
  name: "Hesap Silme Talebi Alındı",
  subject: "Hesap silme talebin alındı",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "core-backend hesap silme işçisi, kişinin kendi silme talebinde SkyMail silmesinden hemen sonra, kişinin her adresine bir kez (ACCOUNT_DELETION_NOTICES=on). Takip edilmez, SkyMail'de kaydı kalmaz (erase_after_send).",
  variables: ["Deadline"],
  sensitiveVariables: [],
  requiredVariables: [
    {
      name: "Deadline",
      reason: "Silmenin son günü (talep + 30 gün, GG.AA.YYYY); KVKK başvurusuna verilen cevabın kendisi. core her gönderimde verir.",
    },
  ],
  sample: {
    Deadline: "30.11.2026",
  },
};

/**
 * The answer to the person's application (KVKK art. 13): it was received and
 * by when it is done. Deletion has no undo, so there is no call to action.
 */
export default function AccountDeletionRequested() {
  return (
    <Shell preview="Hesap silme talebin alındı." brand="account" reason={null}>
      <Context tone="wait">Hesap silme</Context>
      <Title>Silme Talebin Alındı</Title>

      <Paragraph>
        Hesap silme talebin alındı. Verilerin en geç 30 gün içinde (son tarih <Strong>{v("Deadline")}</Strong>) bütün
        hizmetlerden silinecek.
      </Paragraph>

      <Paragraph>Bu işlem geri alınamaz.</Paragraph>

      <Small style={{ marginTop: "24px" }}>Bu talebi sen yapmadıysan info@yildizskylab.com adresine yaz.</Small>
    </Shell>
  );
}
