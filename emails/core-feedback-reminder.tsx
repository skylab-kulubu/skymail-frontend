import * as React from "react";
import { Context, Cta, Paragraph, Shell, Small, Strong, Title } from "./theme";
import { end, ifSet, rangeOver, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.feedback-reminder",
  name: "Geri Bildirim Hatırlatması",
  subject: `Hatırlatma: ${v("EventName")} geri bildirim formu`,
  system: true,
  // Each link carries the recipient's own invite code.
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, ilk geri bildirim postasından 3 gün sonra, tek sefer, henüz cevaplanmamış ve iptal edilmemiş formlarla; kişi başına günde tek posta (ADR-0069).",
  // Same shape as core.feedback-request: Items { Title, URL }, same links.
  variables: ["FirstName", "EventName", "Items"],
  requiredVariables: [{ name: "Items", reason: "Formların başlığı ve kişiye özel bağlantısı; kaldırılırsa posta forma ulaştırmaz." }],
  sample: {
    FirstName: "Yusuf",
    EventName: "GECEKODU 2026",
    Items: [{ Title: "GECEKODU 2026", URL: "https://forms.yildizskylab.com/3f2a9c1e-7b4d-4e8a-9f61-2c5d8e0a4b17?davet=q8Zr2LkV0xNw4TfH6yPa1c" }],
  },
};

/**
 * A guest is matched only by the invite code, which Forms may not report yet,
 * so someone who already answered can get this: it says "if you have not".
 */
export default function CoreFeedbackReminder() {
  return (
    <Shell preview={`${v("EventName")} geri bildirim formu.`} brand="skylab" reason={null}>
      <Context>Hatırlatma</Context>
      <Title>Geri Bildirim</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        <Strong>{v("EventName")}</Strong> için formu henüz doldurmadıysan görüşlerini aşağıdan iletebilirsin.
      </Paragraph>

      {rangeOver("Items")}
      <Cta href={v("URL")}>{v("Title")}</Cta>
      {end}

      <Small>Bağlantılar sana özel.</Small>
    </Shell>
  );
}
