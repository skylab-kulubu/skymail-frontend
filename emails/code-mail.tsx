/**
 * The shape of a "type this code" mail: the person asked for something in an
 * open, signed-in page and proves the mailbox by typing the code back into that
 * same page. It replaces a link on purpose (ADR-0044 update): a link works for
 * whoever clicks it, a code only for the account that asked. So there is no
 * button to press, and the one thing the mail has to say besides the code is
 * never to hand it to anybody.
 */
import * as React from "react";
import { CodeBlock, Context, Note, Paragraph, Shell, Small, Title, type Tone } from "./theme";
import { end, ifSet, v } from "./go";

export function CodeMail({
  preview,
  heading,
  intro,
  /** What the reader should do if they did not ask for this. */
  disclaimer,
  /** The line above the heading: what the mail is about. */
  context = "SKY LAB hesabı",
  tone = "wait",
  /** Why the reader got it, for the footer. */
  reason = "Bu e-postayı, bu adres bir SKY LAB hesabına eklenmek istendiği için alıyorsun.",
}: {
  preview: string;
  heading: React.ReactNode;
  intro: React.ReactNode;
  disclaimer: React.ReactNode;
  context?: React.ReactNode;
  tone?: Tone;
  reason?: React.ReactNode;
}) {
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

      {/* An opaque box with the code-block role, so a client that darkens the
          mail itself inverts it cleanly instead of washing it out. */}
      <div style={{ marginTop: "24px" }}>
        <CodeBlock size={28} center>
          {v("code")}
        </CodeBlock>
      </div>

      {ifSet("codeExpirationMinutes")}
      <Small style={{ textAlign: "center" }}>
        Bu kod {v("codeExpirationMinutes")} dakika geçerli ve yalnızca bir kez kullanılabilir.
      </Small>
      {end}

      <Note tone="alert">
        Bu kodu kimseyle paylaşma. SKY LAB ekibi seni arayıp ya da yazıp bu kodu asla istemez.
      </Note>

      <Small style={{ marginTop: "24px" }}>{disclaimer}</Small>
    </Shell>
  );
}
