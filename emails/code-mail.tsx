/**
 * The shape of a "type this code" mail: the person asked for something in an
 * open, signed-in page and proves the mailbox by typing the code back into that
 * same page. It replaces a link on purpose (ADR-0044 update): a link works for
 * whoever clicks it, a code only for the account that asked. So there is no
 * button to press, and the one thing the mail has to say besides the code is
 * never to hand it to anybody.
 */
import * as React from "react";
import { Heading, Note, Paragraph, Shell, colors, fontStack } from "./theme";
import { Section, Text } from "@react-email/components";
import { end, ifSet, v } from "./go";

export function CodeMail({
  preview,
  heading,
  intro,
  /** What the reader should do if they did not ask for this. */
  disclaimer,
}: {
  preview: string;
  heading: React.ReactNode;
  intro: React.ReactNode;
  disclaimer: React.ReactNode;
}) {
  return (
    <Shell preview={preview} brand="account">
      <Heading>{heading}</Heading>

      <Paragraph>
        {/* firstName is empty for an account that has not filled in a name yet,
            so the greeting has to read correctly without it. */}
        {ifSet("firstName")}Merhaba {v("firstName")}, {end}
        {intro}
      </Paragraph>

      {/* An opaque box with the theme's code-block role, so a client that darkens
          the mail itself inverts it cleanly instead of washing it out. */}
      <Section
        className="code-block"
        style={{
          marginTop: "24px",
          borderRadius: "12px",
          padding: "18px 24px",
          backgroundColor: colors.noteBg,
          border: `1.5px solid ${colors.cardBorder}`,
          textAlign: "center",
        }}
      >
        <Text
          className="t-primary"
          style={{
            margin: 0,
            fontSize: "32px",
            lineHeight: "1.2",
            fontWeight: 700,
            letterSpacing: "8px",
            color: colors.textPrimary,
            fontFamily: "'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
          }}
        >
          {v("code")}
        </Text>
      </Section>

      {ifSet("codeExpirationMinutes")}
      <Text
        className="t-muted"
        style={{
          marginTop: "14px",
          marginBottom: 0,
          fontSize: "13px",
          lineHeight: "1.7",
          color: colors.textMuted,
          fontFamily: fontStack,
          textAlign: "center",
        }}
      >
        Bu kod {v("codeExpirationMinutes")} dakika geçerli ve yalnızca bir kez kullanılabilir.
      </Text>
      {end}

      <Note tone="alert">
        Bu kodu kimseyle paylaşma. SKY LAB ekibi seni arayıp ya da yazıp bu kodu asla istemez.
      </Note>

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
