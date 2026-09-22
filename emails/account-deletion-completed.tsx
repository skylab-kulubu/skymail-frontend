import * as React from "react";
import { Text } from "@react-email/components";
import { Heading, Paragraph, Shell, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "account.deletion-completed",
  name: "Hesap Silindi",
  subject: "SKY LAB hesabın silindi",
  system: true,
  brand: "account",
  trigger: "Account center, anonimleştirme tamamlandığında. Bu, bu adrese gönderdiğimiz son postadır.",
  variables: ["CompletedAt", "RetainedDataNote"],
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
    <Shell preview="SKY LAB hesabın ve kişisel bilgilerin silindi." brand="account">
      <Heading>Hesabın Silindi</Heading>

      <Paragraph>
        SKY LAB hesabın{ifSet("CompletedAt")} {v("CompletedAt")} tarihinde{end} silindi ve kişisel bilgilerin
        sistemlerimizden kaldırıldı.
      </Paragraph>

      {ifSet("RetainedDataNote")}
      <Paragraph>{v("RetainedDataNote")}</Paragraph>
      {end}

      <Paragraph>
        Aramıza tekrar katılmak istersen yeni bir hesap açman yeterli; eski Sky Number'ın geri gelmez, yeni bir tane alırsın.
      </Paragraph>

      <Text
        className="t-faint"
        style={{ marginTop: "28px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Bu silme işlemini sen talep etmediysen info@yildizskylab.com adresine yaz. Seninle birlikteydik, iyi ki geldin.
      </Text>
    </Shell>
  );
}
