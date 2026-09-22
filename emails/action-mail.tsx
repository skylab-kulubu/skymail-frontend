/**
 * The shape every "click this link" mail shares: Keycloak's verification and
 * password-reset mails, and the personal e-mail confirmation Account center
 * sends. They differ only in wording, so the reassurance, the expiry line and
 * the copy-paste fallback live here and stay consistent across all of them.
 */
import * as React from "react";
import { Cta, Heading, LinkFallback, Paragraph, Shell, colors, fontStack } from "./theme";
import { Text } from "@react-email/components";
import { end, ifSet, v } from "./go";

export function ActionMail({
  preview,
  heading,
  intro,
  ctaLabel,
  /** What the reader should do if they did not ask for this. */
  disclaimer,
}: {
  preview: string;
  heading: React.ReactNode;
  intro: React.ReactNode;
  ctaLabel: string;
  disclaimer: React.ReactNode;
}) {
  const link = v("link");

  return (
    <Shell preview={preview} brand="account">
      <Heading>{heading}</Heading>

      <Paragraph>
        {/* firstName is empty for an account that has not filled in a name yet,
            so the greeting has to read correctly without it. */}
        {ifSet("firstName")}Merhaba {v("firstName")}, {end}
        {intro}
      </Paragraph>

      <Cta href={link}>{ctaLabel}</Cta>

      {ifSet("linkExpirationMinutes")}
      <Text
        className="t-muted"
        style={{
          marginTop: "18px",
          marginBottom: 0,
          fontSize: "13px",
          lineHeight: "1.7",
          color: colors.textMuted,
          fontFamily: fontStack,
        }}
      >
        Bu bağlantı {v("linkExpirationMinutes")} dakika geçerli.
      </Text>
      {end}

      <LinkFallback href={link} />

      <Text
        className="t-faint"
        style={{
          marginTop: "24px",
          marginBottom: 0,
          fontSize: "12px",
          lineHeight: "1.7",
          color: colors.textFaint,
          fontFamily: fontStack,
        }}
      >
        {disclaimer}
      </Text>
    </Shell>
  );
}
