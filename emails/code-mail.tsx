/**
 * The shape of a "type this code" mail: the person asked for something in an
 * open, signed-in page and proves the mailbox by typing the code back into that
 * same page. It replaces a link on purpose (ADR-0044 update): a link works for
 * whoever clicks it, a code only for the account that asked. So there is no
 * button to press.
 *
 * Only what the reader needs (Yusuf, 2026-10-19): a title, one sentence saying
 * what the code is for, the code, its expiry, and the same two lines in every
 * code mail — never share it, ignore the mail if you did not ask. No footer
 * sentence about why the mail came.
 */
import * as React from "react";
import { CodeBlock, Context, Note, Paragraph, Shell, Small, Title, type Tone } from "./theme";
import { end, ifSet, v } from "./go";

export function CodeMail({
  preview,
  heading,
  intro,
  /** The line above the heading: what the mail is about. */
  context = "SKY LAB hesabı",
  tone = "wait",
}: {
  preview: string;
  heading: React.ReactNode;
  /** One short sentence: what the code is for. */
  intro: React.ReactNode;
  context?: React.ReactNode;
  tone?: Tone;
}) {
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

      {/* An opaque box with the code-block role, so a client that darkens the
          mail itself inverts it cleanly instead of washing it out. */}
      <div style={{ marginTop: "24px" }}>
        <CodeBlock size={28} center>
          {v("code")}
        </CodeBlock>
      </div>

      {ifSet("codeExpirationMinutes")}
      <Small style={{ textAlign: "center" }}>Bu kod {v("codeExpirationMinutes")} dakika geçerli.</Small>
      {end}

      <Note tone="alert">Bu kodu kimseyle paylaşma.</Note>

      <Small style={{ marginTop: "24px" }}>Bu isteği sen yapmadıysan bu e-postayı yok say.</Small>
    </Shell>
  );
}
