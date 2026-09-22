import * as React from "react";
import { ActionMail } from "./action-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.verify-email",
  name: "Keycloak · E-posta Doğrulama",
  subject: "E-posta adresini doğrula",
  system: true,
  brand: "account",
  trigger: "Keycloak, hesap açılışında veya e-posta doğrulanmamışken (sky-account SPI üzerinden SkyMail'e düşer).",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  // The verification link; Keycloak's SkyMail provider always passes it.
  requiredVariables: ["link"],
  sample: {
    link: "https://e.yildizskylab.com/realms/skylab/login-actions/action-token?key=ornek",
    linkExpirationMinutes: "15",
    firstName: "Yusuf",
    username: "yusuf",
    realmDisplayName: "SKY LAB",
    subjectKey: "emailVerificationSubject",
  },
};

export default function KeycloakVerifyEmail() {
  return (
    <ActionMail
      preview="SKY LAB hesabın için e-posta adresini doğrula."
      heading="E-posta Adresini Doğrula"
      intro="SKY LAB hesabını kullanmaya başlamak için e-posta adresinin sana ait olduğunu doğrulaman gerekiyor."
      ctaLabel="E-postamı Doğrula"
      disclaimer="Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin; doğrulanmayan adresle hesap açılmaz."
    />
  );
}
