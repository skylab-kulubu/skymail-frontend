import * as React from "react";
import { Context, Note, Paragraph, Shell, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.event-cancelled",
  name: "Etkinlik İptali",
  subject: `${v("EventName")} iptal edildi`,
  system: true,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, etkinlik iptal edilirken \"Bilet sahiplerine bildir\" seçiliyse, bilet sahiplerinin her birine bir kez (internal/eventstatusmail).",
  // core-backend/internal/eventstatusmail/service.go vars.
  variables: ["EventName", "EventStart", "CancelReason", "FirstName"],
  requiredVariables: [{ name: "EventName", reason: "Hangi etkinliğin iptal edildiğini söyleyen tek alan; kaldırılırsa posta etkinliği adlandırmaz." }],
  sample: {
    EventName: "GECEKODU 2026",
    EventStart: "14.03.2026 19:00",
    CancelReason: "Salon bakımda olduğu için.",
    FirstName: "Yusuf",
  },
};

/**
 * No call to action: there is nothing to click. The cancellation can be
 * undone (ADR 0066 addendum 2026-10-19), so the mail does not say the ticket
 * is void.
 */
export default function CoreEventCancelled() {
  return (
    <Shell preview={`${v("EventName")} iptal edildi.`} brand="skylab" reason={null}>
      <Context tone="bad">İptal</Context>
      <Title>Etkinlik İptal Edildi</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        <Strong>{v("EventName")}</Strong>
        {ifSet("EventStart")} ({v("EventStart")}){end} etkinliği iptal edildi.
      </Paragraph>

      {ifSet("CancelReason")}
      <Note tone="alert">{v("CancelReason")}</Note>
      {end}

      <Paragraph>Kaydın silinmedi. Etkinlik yeniden yayına alınırsa kaydın geçerli olur.</Paragraph>
    </Shell>
  );
}
