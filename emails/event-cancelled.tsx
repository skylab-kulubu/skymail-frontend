import * as React from "react";
import { Context, Note, Paragraph, Shell, Small, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "event.cancelled",
  name: "Etkinlik · İptal Edildi",
  subject: `${v("EventName")} iptal edildi`,
  system: false,
  contentSensitive: false,
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
    <Shell
      preview={`${v("EventName")} iptal edildi.`}
      brand="skylab"
      reason={<>Bu e-postayı {v("EventName")} etkinliğine kayıtlı olduğun için alıyorsun.</>}
    >
      <Context tone="bad">İptal</Context>
      <Title>Etkinlik İptal Edildi</Title>

      <Paragraph>
        <Strong>{v("EventName")}</Strong> etkinliği iptal edildi. Biletin geçersiz; gelmene gerek yok.
      </Paragraph>

      {ifSet("CancelReason")}
      <Note tone="alert">{v("CancelReason")}</Note>
      {end}

      <Paragraph style={{ marginTop: "24px" }}>Bu kadar geç haber verdiğimiz için kusura bakma.</Paragraph>

      {ifSet("ContactEmail")}
      <Small style={{ marginTop: "24px" }}>Sorun olursa {v("ContactEmail")} adresinden bize ulaşabilirsin.</Small>
      {end}
    </Shell>
  );
}
