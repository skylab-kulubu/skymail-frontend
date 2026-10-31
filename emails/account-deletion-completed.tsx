import * as React from "react";
import { Context, Paragraph, Shell, Small, Title } from "./theme";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.deletion-completed",
  name: "Hesap Silindi",
  subject: "SKY LAB hesabın silindi",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "core-backend hesap silme işçisi, silme tamamlandığında, kişinin silinmeden önce okunan her adresine bir kez (ACCOUNT_DELETION_NOTICES=on). Bu adrese giden son postadır. Takip edilmez, SkyMail'de kaydı kalmaz (erase_after_send).",
  variables: [],
  sensitiveVariables: [],
  requiredVariables: [],
  sample: {},
};

/**
 * The outcome of the person's application (KVKK art. 13). No call to action:
 * there is no account left to act on.
 */
export default function AccountDeletionCompleted() {
  return (
    <Shell preview="SKY LAB hesabın silindi." brand="account" reason={null}>
      <Context tone="neutral">Hesap silme</Context>
      <Title>Hesabın Silindi</Title>

      <Paragraph>Hesabın ve verilerin silindi.</Paragraph>

      <Small style={{ marginTop: "24px" }}>Bu işlemi sen istemediysen info@yildizskylab.com adresine yaz.</Small>
    </Shell>
  );
}
