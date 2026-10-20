import * as React from "react";
import { Context, Paragraph, Shell, Strong, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.event-reinstated",
  name: "Etkinlik Yeniden Yayında",
  subject: `${v("EventName")} yeniden yayında`,
  system: true,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, iptal geri alınırken \"Katılımcılara tekrar bildir\" seçiliyse, iptal postası ulaşan her bilet sahibine bir kez (internal/eventstatusmail).",
  // core-backend/internal/eventstatusmail/service.go vars.
  variables: ["EventName", "EventStart", "FirstName"],
  requiredVariables: [{ name: "EventName", reason: "Hangi etkinliğin yeniden yayında olduğunu söyleyen tek alan; kaldırılırsa posta etkinliği adlandırmaz." }],
  sample: {
    EventName: "GECEKODU 2026",
    EventStart: "14.03.2026 19:00",
    FirstName: "Yusuf",
  },
};

/** Goes only to who got the cancellation mail of the same Event. */
export default function CoreEventReinstated() {
  return (
    <Shell preview={`${v("EventName")} yeniden yayında.`} brand="skylab" reason={null}>
      <Context tone="ok">Yeniden yayında</Context>
      <Title>İptal Geri Alındı</Title>

      <Paragraph>
        {ifSet("FirstName")}Merhaba {v("FirstName")}, {end}
        <Strong>{v("EventName")}</Strong>
        {ifSet("EventStart")} ({v("EventStart")}){end} etkinliğinin iptali geri alındı. Kaydın geçerli.
      </Paragraph>
    </Shell>
  );
}
