import * as React from "react";
import { Context, Cta, Figure, Paragraph, Shell, TextLink, Title, colors, fontStack } from "./theme";
import { elseBranch, end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "club.news",
  name: "Kulüp · Haber ve Duyuru",
  // skymail-backend writes Subject on every News send: the one the sender
  // typed, else the record's title ("Duyuru: " before a duyuru's).
  subject: v("Subject"),
  system: true,
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "SkyMail'de bir News kaydını (inscribed news) e-postayla gönderirken (POST /v1/news_sends; duyuru-haber bilet 06): kaydın o anki hâli, core'un çözdüğü kitlenin her kişisine bir kez.",
  // skymail-backend internal/news Variables. AudienceReason, CategoryLabel and
  // UnsubscribeUrl are each recipient's, from core's audience (core
  // docs/news-audience.md); the rest are the send's. BodyHtml is set only
  // with FullBody (the "Tam metin" format) and goes through the mailer's
  // allowlist (safeHTML).
  variables: [
    "Subject",
    "Preheader",
    "Title",
    "Summary",
    "BodyHtml",
    "FullBody",
    "HeroUrl",
    "HeroAlt",
    "CtaHref",
    "CtaLabel",
    "ReadMoreUrl",
    "KindLabel",
    "AudienceReason",
    "CategoryLabel",
    "UnsubscribeUrl",
  ],
  requiredVariables: [
    {
      name: "ReadMoreUrl",
      reason: "Kaydın sitedeki yerine götüren bağlantı; özet biçiminde postanın devamı yalnız orada okunur.",
    },
    {
      name: "UnsubscribeUrl",
      reason: "Kişinin yalnız bu kategoriden çıkma bağlantısı (core'dan); duyuru postası çıkış yolu olmadan gönderilmez.",
    },
  ],
  sample: {
    Subject: "Duyuru: Bahar dönemi kayıtları açıldı",
    Preheader: "Kayıtlar 5 Mart'a kadar açık.",
    Title: "Bahar dönemi kayıtları açıldı",
    Summary: "Ekiplere katılım için kayıtlar 5 Mart'a kadar açık.",
    BodyHtml:
      "<p>Bahar döneminde ekiplere katılmak isteyenler için kayıtlar açıldı. Başvurular <strong>5 Mart</strong>'ta kapanıyor.</p><p>Ayrıntılar ekiplerin sayfalarında.</p>",
    FullBody: true,
    HeroUrl: "",
    HeroAlt: "",
    CtaHref: "https://forms.yildizskylab.com/f/bahar-kayit",
    CtaLabel: "Başvur",
    ReadMoreUrl: "https://yildizskylab.com/",
    KindLabel: "Duyuru",
    AudienceReason: "SKY LAB üyesi olduğun için",
    CategoryLabel: "Kulüp geneli · Duyurular",
  },
};

/** The club's address a reader writes to (bilet 06: the sender's name and contact in the footer). */
const CONTACT = "info@yildizskylab.com";

/**
 * A News record as mail: the whole body ("Tam metin") or its summary with a
 * link to read on ("Özet + bağlantı"). The footer says why this reader got it
 * and in which category, beside their own way out of that category.
 */
export default function ClubNews() {
  return (
    <Shell
      preview={v("Preheader")}
      brand="skylab"
      reason={`${ifSet("AudienceReason")}Bu e-postayı ${v("AudienceReason")} alıyorsun${ifSet("CategoryLabel")} (${v("CategoryLabel")})${end}.${end}`}
      sender={
        <>
          Gönderen: SKY LAB, Yıldız Teknik Üniversitesi ·{" "}
          <a href={`mailto:${CONTACT}`} className="t-muted" style={{ color: "inherit", textDecoration: "none" }}>
            {CONTACT}
          </a>
        </>
      }
    >
      <Context tone="brand">{v("KindLabel")}</Context>
      <Title>{v("Title")}</Title>

      {ifSet("HeroUrl")}
      <Figure src={v("HeroUrl")} alt={v("HeroAlt")} />
      {end}

      {ifSet("FullBody")}
      <div
        className="t-body free-body"
        style={{ marginTop: "12px", fontSize: "15px", lineHeight: "24px", color: colors.body, fontFamily: fontStack }}
      >
        {"{{safeHTML .BodyHtml}}"}
      </div>
      {elseBranch}
      <Paragraph>{v("Summary")}</Paragraph>
      {end}

      {ifSet("CtaHref")}
      <Cta href={v("CtaHref")}>{v("CtaLabel")}</Cta>
      {end}

      <Paragraph>
        <TextLink href={v("ReadMoreUrl")}>Sitede oku</TextLink>
      </Paragraph>
    </Shell>
  );
}
