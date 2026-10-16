import * as React from "react";
import { Context, Cta, Label, Paragraph, RowItem, Rows, RowsEnd, Shell, Small, Strong, TextLink, Title, colors, fontStack } from "./theme";
import { end, ifNotSet, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.welcome",
  name: "Hoş Geldin",
  subject: "SKY LAB ekosistemine hoş geldin",
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

export default function CoreWelcome() {
  return (
    <Shell
      preview="SKY LAB ekosistemine kaydın tamamlandı — Sky Number'ın hazır."
      brand="skylab"
      reason="Bu e-postayı, bu adresle bir SKY LAB hesabı açıldığı için alıyorsun."
    >
      <Context tone="ok">SKY LAB ekosistemi</Context>
      <Title>Aramıza Hoş Geldin</Title>

      <Paragraph>
        Merhaba {v("FirstName")}, SKY LAB ekosistemine kaydın tamamlandı. Aşağıda kimliğin ve atabileceğin ilk adımlar var.
      </Paragraph>

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
        <p className="t-muted" style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: "18px", color: colors.muted, fontFamily: fontStack }}>
          Kalıcı · değişmez · sana ait
        </p>
      </div>

      <Rows>
        <RowItem label="Ad Soyad">{`${v("FirstName")} ${v("LastName")}`}</RowItem>
        <RowItem label="E-posta">{v("Email")}</RowItem>
        <RowItem label="Katılım">{v("CreatedAt")}</RowItem>
        <RowsEnd />
      </Rows>

      {ifSet("Username")}
      <Paragraph>
        Kullanıcı adın: <Strong>{v("Username")}</Strong>. Kullanıcı adını Hesap Merkezi'nden değiştirebilirsin.
      </Paragraph>
      {end}

      <Paragraph style={{ marginTop: "24px" }}>
        Girişte YTÜ hesabını, e-postana gelen kodu ya da passkey'ini kullanabilirsin. Parola zorunlu değil;
        istersen <TextLink href="https://my.yildizskylab.com">my.yildizskylab.com</TextLink> adresinden ekleyebilirsin.
      </Paragraph>

      {ifNotSet("SchoolEmail")}
      <Paragraph>
        YTÜ öğrencisi ya da personeliysen okul hesabını bağla:{" "}
        <TextLink href="https://my.yildizskylab.com">my.yildizskylab.com</TextLink> → Kimlik → “YTÜ hesabımı bağla”.
        Bölümün otomatik gelir; okul şifreni yalnız Microsoft görür.
      </Paragraph>
      {end}

      <Paragraph>
        Etkinliklerimizi, projelerimizi ve başvuruları <Strong>yildizskylab.com</Strong> üzerinden takip edebilirsin.
        Hesabınla ilgili her şeyi (parola, geçiş anahtarı, e-posta adreslerin) <Strong>my.yildizskylab.com</Strong>
        {" "}adresinden kendin yönetirsin.
      </Paragraph>

      <Paragraph>
        Okul e-postanla katıldıysan: mezun olunca okul adresin kapanabilir. Kişisel e-postanı eklemek için:{" "}
        <TextLink href="https://my.yildizskylab.com/email?intent=add-personal">my.yildizskylab.com/email</TextLink>
      </Paragraph>

      <Cta href="https://yildizskylab.com">Ekosisteme Göz At</Cta>

      <Small style={{ marginTop: "24px" }}>Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.</Small>
    </Shell>
  );
}
