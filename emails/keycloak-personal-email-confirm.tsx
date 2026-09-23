import * as React from "react";
import { CodeMail } from "./code-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.personal-email-confirm",
  name: "Keycloak · Kişisel E-posta Onayı",
  subject: "Kişisel e-posta adresini doğrula",
  system: true,
  brand: "account",
  trigger:
    "Account center'da kişisel e-posta eklendiğinde; 6 haneli kod, 10 dakika geçerli, yalnız isteyen kişinin açık oturumunda çalışır (K3c, ADR-0044 güncellemesi). Keycloak'tan K5 ile gelir.",
  variables: ["code", "codeExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  // The code the member types into Account center; Keycloak's SkyMail provider always passes it.
  requiredVariables: [{ name: "code", reason: "Account center'a girilecek doğrulama kodu; kaldırılırsa kişisel e-posta onaylanamaz." }],
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
      preview="Kişisel e-posta adresini SKY LAB hesabına eklemek için doğrulama kodun."
      heading="Kişisel E-postanı Doğrula"
      intro="SKY LAB hesabına bu adresi kişisel e-posta olarak eklemek istedin. Aşağıdaki kodu Hesap Merkezi'nde açık olan sayfaya gir. Doğruladıktan sonra bu adresle de giriş yapabilir, istersen birincil adresin olarak seçebilirsin."
      disclaimer="Bu isteği sen yapmadıysan bu e-postayı yok say: kod girilmeden adres hesabına eklenmez."
    />
  );
}
