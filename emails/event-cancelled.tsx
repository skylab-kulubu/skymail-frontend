import * as React from "react";
import { Text } from "@react-email/components";
import { Chip, Heading, Note, Paragraph, Shell, Strong, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.cancelled",
  name: "Etkinlik · İptal Edildi",
  subject: `${v("EventName")} iptal edildi`,
  system: false,
  brand: "skylab",
  trigger: "Etkinlik iptal edildiğinde, bileti olan herkese. NOT: gönderim kodu henüz yazılmadı.",
  variables: ["EventName", "CancelReason", "ContactEmail"],
  sample: {
    EventName: "GECEKODU 2026",
    CancelReason: "Kampüsteki bakım çalışması nedeniyle salon kullanılamıyor. Yeni tarihi en kısa sürede duyuracağız.",
    ContactEmail: "info@yildizskylab.com",
  },
};

/**
 * No call to action on purpose: there is nothing left to click, and a button
 * here would read as if the event were still happening.
 */
export default function EventCancelled() {
  return (
    <Shell preview={`${v("EventName")} iptal edildi.`} brand="skylab">
      <Heading>Etkinlik İptal Edildi</Heading>

      <Chip tone="alert">İptal</Chip>

      <Paragraph style={{ marginTop: "18px" }}>
        <Strong>{v("EventName")}</Strong> etkinliği iptal edildi. Biletin geçersiz; gelmene gerek yok.
      </Paragraph>

      {ifSet("CancelReason")}
      <div style={{ marginTop: "20px" }}>
        <Note tone="alert">{v("CancelReason")}</Note>
      </div>
      {end}

      <Paragraph style={{ marginTop: "24px" }}>Bu kadar geç haber verdiğimiz için kusura bakma.</Paragraph>

      {ifSet("ContactEmail")}
      <Text
        className="t-faint"
        style={{ marginTop: "24px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Sorun olursa {v("ContactEmail")} adresinden bize ulaşabilirsin.
      </Text>
      {end}
    </Shell>
  );
}
