import * as React from "react";
import { Context, Cta, Label, Paragraph, RowItem, Rows, RowsEnd, Shell, TextLink, Title, colors, fontStack } from "./theme";
import { end, ifNotSet, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.welcome",
  name: "Hoş Geldin",
  subject: "SKY LAB'e hoş geldin",
  system: true,
  contentSensitive: false,
  brand: "skylab",
  trigger: "core-backend, yeni bir User ilk kez göründüğünde (SKYMAIL_WELCOME_TEMPLATE_ID).",
  // core-backend/internal/mail/mail.go: kimlik alanları boş da olsa gönderilir.
  variables: ["FirstName", "LastName", "Email", "Username", "SchoolEmail", "SkyNumber", "CreatedAt"],
  // Nothing: the mail welcomes without an action, and every fact in it is also in Account center.
  requiredVariables: [],
  sample: {
    FirstName: "Örnek",
    LastName: "Kullanıcı",
    Email: "ornek@example.com",
    Username: "ornek.kullanici",
    SchoolEmail: "",
    SkyNumber: "SKY-0042",
    CreatedAt: "2026-10-16T09:00:00Z",
  },
};

/**
 * Only what the new member needs (Yusuf, 2026-10-19): the Sky Number, the
 * account's facts, how to sign in (Y1: the welcome says it) and the two links
 * to act on, school linking only while no school account is linked.
 */
export default function CoreWelcome() {
  return (
    <Shell preview="SKY LAB hesabın açıldı." brand="skylab" reason={null}>
      <Context tone="ok">SKY LAB</Context>
      <Title>Hoş Geldin</Title>

      <Paragraph>Merhaba {v("FirstName")}, SKY LAB hesabın açıldı.</Paragraph>

      <div style={{ marginTop: "28px" }}>
        <Label>Sky Number</Label>
        <p
          className="t-link"
          style={{
            margin: "4px 0 0",
            fontSize: "32px",
            fontWeight: 600,
            letterSpacing: "0.02em",
            lineHeight: "40px",
            color: colors.link,
            fontFamily: fontStack,
          }}
        >
          {v("SkyNumber")}
        </p>
      </div>

      <Rows>
        <RowItem label="Ad Soyad">{`${v("FirstName")} ${v("LastName")}`}</RowItem>
        <RowItem label="E-posta">{v("Email")}</RowItem>
        {ifSet("Username")}
        <RowItem label="Kullanıcı adı">{v("Username")}</RowItem>
        {end}
        <RowItem label="Katılım">{v("CreatedAt")}</RowItem>
        <RowsEnd />
      </Rows>

      <Paragraph style={{ marginTop: "24px" }}>Giriş: YTÜ hesabı, e-posta kodu ya da passkey. Parola isteğe bağlı.</Paragraph>

      {ifNotSet("SchoolEmail")}
      <Paragraph>
        YTÜ hesabını bağla: <TextLink href="https://my.yildizskylab.com">my.yildizskylab.com</TextLink> → Kimlik
      </Paragraph>
      {end}

      <Paragraph>
        Kişisel e-posta ekle:{" "}
        <TextLink href="https://my.yildizskylab.com/email?intent=add-personal">my.yildizskylab.com/email</TextLink>
      </Paragraph>

      <Cta href="https://my.yildizskylab.com">Hesap Merkezi</Cta>
    </Shell>
  );
}
