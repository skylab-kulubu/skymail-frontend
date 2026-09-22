import * as React from "react";
import { ActionMail } from "./action-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.reset-password",
  name: "Keycloak · Parola Sıfırlama",
  subject: "SKY LAB parola sıfırlama isteği",
  system: true,
  brand: "account",
  trigger: "Keycloak, giriş ekranında \"parolamı unuttum\" akışında.",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  // The reset link; Keycloak's SkyMail provider always passes it.
  requiredVariables: ["link"],
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
      preview="SKY LAB parolanı sıfırlamak için bir bağlantı istendi."
      heading="Parolanı Sıfırla"
      intro="SKY LAB hesabının parolasını sıfırlamak için bir istek aldık. Yeni parolanı belirlemek için aşağıdaki bağlantıyı kullan."
      ctaLabel="Yeni Parola Belirle"
      disclaimer="Bu isteği sen yapmadıysan parolan değişmedi; bu e-postayı yok sayman yeterli. Hesabına birinin eriştiğinden şüpheleniyorsan info@yildizskylab.com adresinden bize yaz."
    />
  );
}
