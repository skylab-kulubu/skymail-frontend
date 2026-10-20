import * as React from "react";
import { ActionMail } from "./action-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.idp-link",
  name: "Keycloak · YTÜ Hesabı Bağlama",
  subject: "YTÜ hesabını SKY LAB hesabına bağla",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger: "Keycloak, YTÜ Microsoft kimliği mevcut bir SKY LAB hesabına bağlanırken (IdP link).",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  sensitiveVariables: ["link"],
  // The link that confirms the account link; Keycloak's SkyMail provider always passes it.
  requiredVariables: [{ name: "link", reason: "YTÜ hesabını bağlamayı onaylama bağlantısı; kaldırılırsa hesaplar bağlanamaz." }],
  sample: {
    link: "https://e.yildizskylab.com/realms/skylab/login-actions/action-token?key=ornek",
    linkExpirationMinutes: "15",
    firstName: "Yusuf",
    username: "yusuf",
    realmDisplayName: "SKY LAB",
    subjectKey: "identityProviderLinkSubject",
  },
};

export default function KeycloakIdpLink() {
  return (
    <ActionMail
      preview="YTÜ hesabını SKY LAB hesabına bağla."
      heading="YTÜ Hesabını Bağla"
      intro="YTÜ Microsoft hesabını SKY LAB hesabına bağlamak için onayla."
      ctaLabel="Hesapları Bağla"
      context="Hesap bağlama"
    />
  );
}
