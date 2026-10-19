/**
 * The shape every "click this link" mail shares: Keycloak's verification and
 * password-reset mails. They differ only in wording, so the expiry line, the
 * copy-paste fallback and the closing line live here and stay consistent
 * across all of them. (Account center's personal e-mail proof is a code, see
 * code-mail.)
 *
 * Only what the reader needs (Yusuf, 2026-10-19): a title, one sentence saying
 * what the link does, the link, its expiry, and "ignore the mail if you did not
 * ask". No footer sentence about why the mail came.
 */
import * as React from "react";
import { Context, Cta, LinkFallback, Paragraph, Shell, Small, Title, type Tone } from "./theme";
import { end, ifSet, v } from "./go";

export function ActionMail({
  preview,
  heading,
  intro,
  ctaLabel,
  /** The line above the heading: what the mail is about. */
  context = "SKY LAB hesabı",
  tone = "wait",
}: {
  preview: string;
  heading: React.ReactNode;
  /** One short sentence: what the link does. */
  intro: React.ReactNode;
  ctaLabel: string;
  context?: React.ReactNode;
  tone?: Tone;
}) {
  const link = v("link");

  return (
    <Shell preview={preview} brand="account" reason={null}>
      <Context tone={tone}>{context}</Context>
      <Title>{heading}</Title>

      <Paragraph>
        {/* firstName is empty for an account that has not filled in a name yet,
            so the greeting has to read correctly without it. */}
        {ifSet("firstName")}Merhaba {v("firstName")}, {end}
        {intro}
      </Paragraph>

      <Cta href={link}>{ctaLabel}</Cta>

      {ifSet("linkExpirationMinutes")}
      <Small>Bu bağlantı {v("linkExpirationMinutes")} dakika geçerli.</Small>
      {end}

      <LinkFallback href={link} />

      <Small style={{ marginTop: "24px" }}>Bu isteği sen yapmadıysan bu e-postayı yok say.</Small>
    </Shell>
  );
}
