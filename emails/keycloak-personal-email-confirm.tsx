import * as React from "react";
import { CodeMail } from "./code-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.personal-email-confirm",
  name: "Keycloak · Kişisel E-posta Onayı",
  subject: "Kişisel e-posta adresini doğrula",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "Account center'da ya da ilk YTÜ girişinin sonundaki öneride kişisel e-posta eklendiğinde; 6 haneli kod, 10 dakika geçerli, yalnız isteyen kişinin açık oturumunda çalışır (K3c, ADR-0044 güncellemesi). Keycloak'tan K5 ile gelir.",
  variables: ["code", "codeExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  sensitiveVariables: ["code"],
  // The code the member types into Account center or the sign-in page; Keycloak's SkyMail provider always passes it.
  requiredVariables: [{ name: "code", reason: "Account center'a ya da giriş sayfasına girilecek doğrulama kodu; kaldırılırsa kişisel e-posta onaylanamaz." }],
  sample: {
    code: "048213",
    codeExpirationMinutes: "10",
    firstName: "Yusuf",
    username: "yusuf",
    realmDisplayName: "SKY LAB",
    subjectKey: "skyPersonalEmailConfirmSubject",
  },
};

export default function KeycloakPersonalEmailConfirm() {
  return (
    <CodeMail
      preview="Kişisel e-posta adresin için doğrulama kodun."
      heading="Kişisel E-postanı Doğrula"
      intro="Bu adresi SKY LAB hesabına kişisel e-posta olarak eklemek için kodun aşağıda."
      context="Kişisel e-posta"
    />
  );
}
