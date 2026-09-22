import * as React from "react";
import { ActionMail } from "./action-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.personal-email-confirm",
  name: "Keycloak · Kişisel E-posta Onayı",
  subject: "Kişisel e-posta adresini doğrula",
  system: true,
  brand: "account",
  trigger:
    "Account center'da kişisel e-posta eklendiğinde; bağlantı https://my.yildizskylab.com/email/confirm?token=… biçiminde ve 30 dakika geçerli (K3c).",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  sample: {
    link: "https://my.yildizskylab.com/email/confirm?token=ornek",
    linkExpirationMinutes: "30",
    firstName: "Yusuf",
    username: "yusuf",
    realmDisplayName: "SKY LAB",
    subjectKey: "personalEmailConfirmSubject",
  },
};

export default function KeycloakPersonalEmailConfirm() {
  return (
    <ActionMail
      preview="Kişisel e-posta adresini SKY LAB hesabına eklemek için doğrula."
      heading="Kişisel E-postanı Doğrula"
      intro="Bu adresi SKY LAB hesabına kişisel e-posta olarak eklemek istedin. Doğruladıktan sonra bu adresle de giriş yapabilir, istersen birincil adresin olarak seçebilirsin."
      ctaLabel="Adresi Doğrula"
      disclaimer="Bu isteği sen yapmadıysan bu e-postayı yok say: adres doğrulanmadan hesabına eklenmez."
    />
  );
}
