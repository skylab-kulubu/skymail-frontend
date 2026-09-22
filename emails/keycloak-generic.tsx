import * as React from "react";
import { Text } from "@react-email/components";
import { Cta, Heading, Label, LinkFallback, Paragraph, Shell, colors, fontStack } from "./theme";
import { end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "keycloak.generic",
  name: "Keycloak · Genel Sistem Postası",
  subject: "SKY LAB hesap bildirimi",
  system: true,
  brand: "account",
  trigger:
    "Keycloak gönderici SPI'ın yedeği: eşlenmemiş bir sistem postası (ileride eklenecek bir required action gibi) bu anahtara düşer. subjectKey hangi posta olduğunu söyler.",
  variables: ["link", "linkExpirationMinutes", "firstName", "username", "realmDisplayName", "subjectKey"],
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
 * the account needs an action and shows the link. The subjectKey is printed so
 * whoever receives a report of a confusing mail can tell which one it was and
 * give it a proper template.
 */
export default function KeycloakGeneric() {
  const link = v("link");

  return (
    <Shell preview="SKY LAB hesabınla ilgili bir işlem bekliyor." brand="account">
      <Heading>Hesabınla İlgili Bir İşlem Var</Heading>

      <Paragraph>
        {ifSet("firstName")}Merhaba {v("firstName")}, {end}
        SKY LAB hesabınla ilgili tamamlanması gereken bir işlem var. Devam etmek için aşağıdaki bağlantıyı kullan.
      </Paragraph>

      <Cta href={link}>Devam Et</Cta>

      {ifSet("linkExpirationMinutes")}
      <Text
        className="t-muted"
        style={{ marginTop: "18px", marginBottom: 0, fontSize: "13px", lineHeight: "1.7", color: colors.textMuted, fontFamily: fontStack }}
      >
        Bu bağlantı {v("linkExpirationMinutes")} dakika geçerli.
      </Text>
      {end}

      <LinkFallback href={link} />

      {ifSet("subjectKey")}
      <div style={{ marginTop: "24px" }}>
        <Label>İşlem Kodu</Label>
        <Text
          className="code-block"
          style={{
            margin: "6px 0 0",
            padding: "8px 12px",
            borderRadius: "8px",
            border: `1px solid ${colors.cardBorder}`,
            backgroundColor: "rgba(143,94,152,0.06)",
            fontSize: "12px",
            color: colors.textBody,
            fontFamily: "'SF Mono', Menlo, Consolas, monospace",
          }}
        >
          {v("subjectKey")}
        </Text>
      </div>
      {end}

      <Text
        className="t-faint"
        style={{ marginTop: "24px", marginBottom: 0, fontSize: "12px", lineHeight: "1.7", color: colors.textFaint, fontFamily: fontStack }}
      >
        Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin. Bu posta sana anlamsız geldiyse yukarıdaki işlem koduyla birlikte
        info@yildizskylab.com adresine yaz — o postanın kendi şablonunu yazalım.
      </Text>
    </Shell>
  );
}
