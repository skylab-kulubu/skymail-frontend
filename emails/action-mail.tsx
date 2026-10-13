/**
 * The shape every "click this link" mail shares: Keycloak's verification and
 * password-reset mails. They differ only in wording, so the reassurance, the
 * expiry line and the copy-paste fallback live here and stay consistent across
 * all of them. (Account center's personal e-mail proof is a code, see code-mail.)
 */
import * as React from "react";
import { Context, Cta, LinkFallback, Paragraph, Shell, Small, Title, type Tone } from "./theme";
import { end, ifSet, v } from "./go";

export function ActionMail({
  preview,
  heading,
  intro,
  ctaLabel,
  /** What the reader should do if they did not ask for this. */
  disclaimer,
  /** The line above the heading: what the mail is about. */
  context = "SKY LAB hesabı",
  tone = "wait",
  /** Why the reader got it, for the footer. */
  reason = "Bu e-postayı, bu adrese bağlı SKY LAB hesabı için bir işlem istendiği için alıyorsun.",
}: {
  preview: string;
  heading: React.ReactNode;
  intro: React.ReactNode;
  ctaLabel: string;
  disclaimer: React.ReactNode;
  context?: React.ReactNode;
  tone?: Tone;
  reason?: React.ReactNode;
}) {
  const link = v("link");

  return (
    <Shell preview={preview} brand="account" reason={reason}>
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

      <Small style={{ marginTop: "24px" }}>{disclaimer}</Small>
    </Shell>
  );
}
