import * as React from "react";
import { ActionMail } from "./action-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.reset-password",
  name: "Keycloak · Parola Sıfırlama",
  subject: "SKY LAB parola sıfırlama isteği",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger: "Keycloak, giriş ekranında \"parolamı unuttum\" akışında.",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  sensitiveVariables: ["link"],
  // The reset link; Keycloak's SkyMail provider always passes it.
  requiredVariables: [{ name: "link", reason: "Parola sıfırlama bağlantısı; kaldırılırsa kişi parolasını sıfırlayamaz ve mail işe yaramaz." }],
  sample: {
    link: "https://e.yildizskylab.com/realms/skylab/login-actions/reset-credentials?key=ornek",
    linkExpirationMinutes: "15",
    firstName: "Yusuf",
    username: "yusuf",
    realmDisplayName: "SKY LAB",
    subjectKey: "passwordResetSubject",
  },
};

export default function KeycloakResetPassword() {
  return (
    <ActionMail
      preview="SKY LAB parolanı sıfırlama bağlantın."
      heading="Parolanı Sıfırla"
      intro="Yeni parolanı belirlemek için aşağıdaki bağlantıyı kullan."
      ctaLabel="Yeni Parola Belirle"
      context="Parola sıfırlama"
    />
  );
}
