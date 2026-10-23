import * as React from "react";
import { Context, Cta, Paragraph, Shell, Small, Strong, Title } from "./theme";
import { end, ifSet, rangeOver, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.feedback-request",
  name: "Geri Bildirim İsteği",
  subject: `${v("EventName")} geri bildirim formu`,
  system: true,
  // Each link carries the recipient's own invite code.
  contentSensitive: true,
  brand: "skylab",
  trigger:
    "core-backend, etkinlik ya da oturum bitişinden 2 saat sonra (ya da \"Şimdi gönder\" ile) yoklaması alınan her bilet sahibine; kişi başına günde tek posta, o günün formları tek listede (ADR-0069).",
  // Items: one per target (the Event or an Oturum), each { Title, URL }; URL
  // is the Form address with the recipient's invite code, not a Short link.
  variables: ["FirstName", "EventName", "Items"],
  requiredVariables: [{ name: "Items", reason: "Formların başlığı ve kişiye özel bağlantısı; kaldırılırsa posta forma ulaştırmaz." }],
  sample: {
    FirstName: "Yusuf",
    EventName: "GECEKODU 2026",
    Items: [
      { Title: "Açılış konuşması", URL: "https://forms.yildizskylab.com/3f2a9c1e-7b4d-4e8a-9f61-2c5d8e0a4b17?davet=q8Zr2LkV0xNw4TfH6yPa1c" },
      { Title: "Go atölyesi", URL: "https://forms.yildizskylab.com/8b1e4d7a-2c9f-4a3b-b5e6-0d7c1f9a2e48?davet=Hn3Ks7Qw9Ld2Vx5Mb8Rt0e" },
    ],
  },
};

/** One row per form; a single target is a one-element list. */
export default function CoreFeedbackRequest() {
  return (
    <Shell preview={`${v("EventName")} geri bildirim formu.`} brand="skylab" reason={null}>
      <Context>Geri bildirim</Context>
      <Title>Geri Bildirim</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        <Strong>{v("EventName")}</Strong> hakkındaki görüşlerini aşağıdan iletebilirsin.
      </Paragraph>

      {rangeOver("Items")}
      <Cta href={v("URL")}>{v("Title")}</Cta>
      {end}

      <Small>Bağlantılar sana özel.</Small>
    </Shell>
  );
}
