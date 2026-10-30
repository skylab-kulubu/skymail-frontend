import * as React from "react";
import { Context, Cta, LinkFallback, Paragraph, Shell, Strong, Title } from "./theme";
import { elseBranch, end, ifSet, v } from "./go";
import type { TemplateMeta } from "./types";

export const meta: TemplateMeta = {
  key: "core.team-page-consent-notice",
  name: "Ekip Sayfası İzni Bildirimi",
  subject: "Ekip sayfalarında görünürlüğün",
  system: true,
  // A notice in the club's own words; the settings link needs a sign-in.
  contentSensitive: false,
  brand: "skylab",
  trigger:
    "core-backend, `core-backend team-page-notice -apply` komutuyla, ekip sayfası izninin geçişi başlarken (TEAM_PAGE_CONSENT_GRACE_UNTIL) bir kez: herkese açık bir ekip sayfasında listelenen ve izin konusunda karar vermemiş her üyeye tek posta (birden çok ekip tek postada). İşlem postası, tercih okumaz (docs/team-page-consent.md, ekip-yetki-devri 21).",
  // Teams: the public rosters the person is listed on, "KOD · Türkçe ad",
  // comma-separated. HideAt: the end of the transition, "11.11.2026 00:00"
  // (Europe/Istanbul). SettingsURL: Account Center's Kulüp profili page.
  // Board: "true" when the person is listed on the Board's own roster and
  // stays there by first and last name without the consent; otherwise empty.
  // FirstName may be empty.
  variables: ["FirstName", "Teams", "HideAt", "SettingsURL", "Board"],
  requiredVariables: [
    { name: "HideAt", reason: "Geçişin bittiği an; kaldırılırsa posta sayfalardan ne zaman kaldırılacağını söylemez." },
    { name: "SettingsURL", reason: "İzni açacağı Hesap Merkezi sayfası; kaldırılırsa üye ayarı bulamaz." },
  ],
  sample: {
    FirstName: "Yusuf",
    Teams: "WEBLAB · Web Geliştirme, AGC",
    HideAt: "11.11.2026 00:00",
    SettingsURL: "https://my.yildizskylab.com/club-profile",
    Board: "",
  },
};

/**
 * One notice, sent once (ekip-yetki-devri 21): the person's data will leave
 * the public team pages unless they consent. No promotion and no event news
 * goes into it: it is a transactional mail (stream islem).
 */
export default function CoreTeamPageConsentNotice() {
  const settings = v("SettingsURL");
  return (
    <Shell preview="Ekip sayfalarında görünmek için izin gerekecek." brand="skylab" reason={null}>
      <Context tone="wait">Ekip sayfaları</Context>
      <Title>Ekip Sayfaları Artık İzinle</Title>

      {ifSet("FirstName")}
      <Paragraph>Merhaba {v("FirstName")},</Paragraph>
      {end}

      <Paragraph>
        Adın ve profil bilgilerin SKY LAB&apos;in sitesindeki ve uygulamasındaki şu ekip sayfalarında görünüyor:{" "}
        <Strong>{v("Teams")}</Strong>.
      </Paragraph>

      <Paragraph>
        <Strong>{v("HideAt")}</Strong> itibarıyla bu sayfalarda yalnız izin veren üyeler görünecek.{" "}
        {ifSet("Board")}
        Yönetim Kurulu üyesi olduğun için Yönetim Kurulu sayfasında adın ve soyadın görünmeye devam eder; fotoğrafın ve diğer
        bilgilerin yalnız izin verirsen görünür. Öteki ekip sayfalarında da yalnız izin verirsen görünürsün.
        {elseBranch}
        İzin vermezsen bu sayfalardan kaldırılırsın.
        {end}
      </Paragraph>

      <Paragraph>Görünmek istersen Hesap Merkezi&apos;nde Kulüp profili sayfasındaki &quot;Ekip sayfaları&quot; ayarını aç.</Paragraph>

      <Cta href={settings}>Ayarı Aç</Cta>

      <LinkFallback href={settings} />
    </Shell>
  );
}
