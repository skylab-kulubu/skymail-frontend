import * as React from "react";
import { ActionMail } from "./action-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.update-email",
  name: "Keycloak · E-posta Değişikliği Doğrulama",
  subject: "Yeni e-posta adresini doğrula",
  system: true,
  brand: "account",
  trigger: "Keycloak, kişi hesabının e-posta adresini değiştirdiğinde — doğrulama YENİ adrese gider.",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  // The link that confirms the new address; Keycloak's SkyMail provider always passes it.
  requiredVariables: ["link"],
  sample: {
    link: "https://e.yildizskylab.com/realms/skylab/login-actions/action-token?key=ornek",
    linkExpirationMinutes: "15",
    firstName: "Yusuf",
    username: "yusuf",
    realmDisplayName: "SKY LAB",
    subjectKey: "emailUpdateConfirmationSubject",
  },
};

export default function KeycloakUpdateEmail() {
  return (
    <ActionMail
      preview="SKY LAB hesabının yeni e-posta adresini doğrula."
      heading="Yeni E-posta Adresini Doğrula"
      intro="SKY LAB hesabının e-posta adresini bu adresle değiştirmek istedin. Değişikliğin tamamlanması için adresi doğrulaman gerekiyor."
      ctaLabel="Adresi Doğrula"
      disclaimer="Bu değişikliği sen istemediysen bağlantıya dokunma: doğrulanmadığı sürece hesabının adresi değişmez."
    />
  );
}
