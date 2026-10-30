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
    "core-backend (üyeye Bildirim olarak: e-posta + kutu; misafire yalnız e-posta), ilk geri bildirim postasından 3 gün sonra, tek sefer, henüz cevaplanmamış ve iptal edilmemiş formlarla; kişi başına günde tek posta (ADR-0069).",
  // Same shape as core.feedback-request: Items { Title, URL }, same links.
  variables: ["FirstName", "EventName", "Items", "EventId"],
  requiredVariables: [{ name: "Items", reason: "Formların başlığı ve kişiye özel bağlantısı; kaldırılırsa posta forma ulaştırmaz." }],
  // A member gets it as a Notification (POST /v1/notifications), so it also
  // lands in the inbox; a guest by e-mail alone. The inbox item names the
  // Event and its forms and opens the Event: the personal links stay in the
  // mail. EventId is for the inbox only.
  notification: {
    category: null,
    required: true,
    defaultChannels: ["email", "inbox"],
    lane: "system",
    inbox: {
      title: `Hatırlatma: ${v("EventName")} geri bildirim formu`,
      summary: "{{range $i, $item := .Items}}{{if $i}}, {{end}}{{$item.Title}}{{end}}",
      link: `/events/${v("EventId")}`,
    },
  },
  sample: {
    FirstName: "Yusuf",
    EventName: "GECEKODU 2026",
    EventId: "6f1c2b9e-4d3a-4b7e-9a51-0c8d2e7f4a19",
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
