import * as React from "react";
import { ActionMail } from "./action-mail";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.idp-link",
  name: "Keycloak · YTÜ Hesabı Bağlama",
  subject: "YTÜ hesabını SKY LAB hesabına bağla",
  system: true,
  brand: "account",
  trigger: "Keycloak, YTÜ Microsoft kimliği mevcut bir SKY LAB hesabına bağlanırken (IdP link).",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
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
      preview="YTÜ hesabını SKY LAB hesabına bağlamak için onay bekleniyor."
      heading="YTÜ Hesabını Bağla"
      intro="YTÜ Microsoft hesabını mevcut SKY LAB hesabına bağlamak için bir istek aldık. Bağlandığında okul e-posta adresin doğrulanmış sayılır ve YTÜ hesabınla da giriş yapabilirsin."
      ctaLabel="Hesapları Bağla"
      disclaimer="Bu isteği sen yapmadıysan bağlantıya dokunma; hesapların bağlanmaz."
    />
  );
}
