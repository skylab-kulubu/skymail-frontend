import * as React from "react";
import { Context, Paragraph, Shell, Small, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.deletion-completed",
  name: "Hesap Silindi",
  subject: "SKY LAB hesabın silindi",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger: "Account center, anonimleştirme tamamlandığında. Bu, bu adrese gönderdiğimiz son postadır.",
  variables: ["CompletedAt", "RetainedDataNote"],
  sensitiveVariables: [],
  // Nothing yet: no service sends it.
  requiredVariables: [],
  sample: {
    CompletedAt: "29.09.2026",
    RetainedDataNote:
      "Katılım kayıtların ve düzenlenmiş sertifikaların, doğrulanabilir kalmaları için kimliğinden koparılarak saklanıyor.",
  },
};

/**
 * No call to action: there is no account left to act on. The mail exists so the
 * person has a record that the deletion finished, and so a deletion that
 * finished without them asking is visible.
 */
export default function AccountDeletionCompleted() {
  return (
    <Shell preview="SKY LAB hesabın silindi." brand="account" reason={null}>
      <Context tone="neutral">Hesap silme</Context>
      <Title>Hesabın Silindi</Title>

      <Paragraph>
        SKY LAB hesabın{ifSet("CompletedAt")} {v("CompletedAt")} tarihinde{end} silindi ve kişisel bilgilerin
        sistemlerimizden kaldırıldı.
      </Paragraph>

      {ifSet("RetainedDataNote")}
      <Paragraph>{v("RetainedDataNote")}</Paragraph>
      {end}

      <Small style={{ marginTop: "24px" }}>Bu işlemi sen istemediysen info@yildizskylab.com adresine yaz.</Small>
    </Shell>
  );
}
