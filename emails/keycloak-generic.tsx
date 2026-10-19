import * as React from "react";
import { CodeBlock, Context, Cta, Label, LinkFallback, Paragraph, Shell, Small, Title } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.generic",
  name: "Keycloak · Genel Sistem Postası",
  subject: "SKY LAB hesap bildirimi",
  system: true,
  contentSensitive: true,
  brand: "account",
  trigger:
    "Keycloak gönderici SPI'ın yedeği: eşlenmemiş bir sistem postası (ileride eklenecek bir required action gibi) bu anahtara düşer. subjectKey hangi posta olduğunu söyler.",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
  sensitiveVariables: ["link"],
  // Nothing: Keycloak's SkyMail provider sends link as "" for the event mails
  // that fall back here (sendEvent), so the mail cannot count on one.
  requiredVariables: [],
  sample: {
    link: "https://e.yildizskylab.com/realms/skylab/login-actions/action-token?key=ornek",
    linkExpirationMinutes: "15",
    firstName: "Yusuf",
    username: "yusuf",
    realmDisplayName: "SKY LAB",
    subjectKey: "updatePasswordSubject",
  },
};

/**
 * Deliberately vague: this renders for a mail nobody has written wording for
 * yet. It must stay useful without knowing what happened, so it says only that
 * the account has an action and shows the link. The subjectKey is printed so
 * whoever receives a report of a confusing mail can tell which one it was and
 * give it a proper template.
 */
export default function KeycloakGeneric() {
  const link = v("link");

  return (
    <Shell preview="SKY LAB hesabınla ilgili bir işlem var." brand="account" reason={null}>
      <Context>Hesap bildirimi</Context>
      <Title>Hesabınla İlgili Bir İşlem Var</Title>

      <Paragraph>
        {ifSet("firstName")}Merhaba {v("firstName")}, {end}
        SKY LAB hesabınla ilgili bir işlem var.
      </Paragraph>

      {/*
        Unlike the other Keycloak templates, this one runs for mails that have no
        action to take — the sender passes an empty link for those. An
        unconditional button would render with href="".
      */}
      {ifSet("link")}
      <Cta href={link}>Devam Et</Cta>
      {end}

      {ifSet("linkExpirationMinutes")}
      <Small>Bu bağlantı {v("linkExpirationMinutes")} dakika geçerli.</Small>
      {end}

      {ifSet("link")}
      <LinkFallback href={link} />
      {end}

      {ifSet("subjectKey")}
      <div style={{ marginTop: "24px" }}>
        <Label>İşlem Kodu</Label>
        <CodeBlock size={12}>{v("subjectKey")}</CodeBlock>
      </div>
      {end}

      <Small style={{ marginTop: "24px" }}>Bu isteği sen yapmadıysan bu e-postayı yok say.</Small>
    </Shell>
  );
}
