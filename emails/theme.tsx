/**
 * The shared shell every SKY LAB e-mail is built from.
 *
 * Two things make e-mail styling awkward and both are handled here so a template
 * author never has to think about them:
 *
 *  - Dark mode. Inline styles are the light theme, because that is what clients
 *    without `prefers-color-scheme` render. Role classes (.t-primary, .card, …)
 *    carry the dark theme with `!important`, so a client that does understand
 *    the media query flips the whole mail at once.
 *  - Backgrounds. Gmail strips `background-color` off `<body>` and off `<div>`,
 *    so the page background is painted on a full-width table with the `bgcolor`
 *    HTML attribute instead.
 *
 * Variables are Go templates rendered by skymail-backend, not React props. A
 * template writes `{{.formTitle}}`; the mailer substitutes it per send. Missing
 * variables render as empty in HTML but as `<no value>` in the subject and the
 * plain-text part, so only ever put a variable in a subject when the sender is
 * guaranteed to supply it.
 */
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export const colors = {
  skylab300: "#f3e8f5",
  skylab400: "#ebd5ee",
  skylab500: "#e0c8e5",
  skylab600: "#c8a4ce",
  skylab700: "#ae7eb6",
  skylab800: "#8f5e98",
  skylab900: "#6e4576",
  pageBg: "#f4f1f7",
  // Every surface is opaque on purpose. A mail client that darkens a light
  // e-mail by itself — which is most of them, because `prefers-color-scheme`
  // is not something an e-mail can rely on — darkens what is behind a
  // translucent layer but leaves the layer, and the result is the washed-out
  // grey-on-grey we shipped first. Opaque colours inverse predictably.
  cardBg: "#fbfafc",
  cardBorder: "#e2d7e6",
  textPrimary: "#1b1620",
  textBody: "#4a4253",
  textMuted: "#6f6579",
  textFaint: "#8c8397",
  divider: "#e7e6e8",
  noteBg: "#f5f1f6",
  ctaBg: "#ece4ee",
  ctaBorder: "#cab4cf",
  // A caution accent for the mails that report something the reader may need to
  // undo — a password change they did not make, a cancelled event.
  alert: "#b06b78",
  alertBg: "#f3e3e5",
  alertBorder: "#dcb6bd",
  alertText: "#9e5560",
} as const;

export const fontStack = "'Space Grotesk', Helvetica, Arial, sans-serif";

const LOGO = "https://forms.yildizskylab.com/skylab.svg";

const darkStarfield = [
  "radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.35), transparent 50%)",
  "radial-gradient(1px 1px at 28% 62%, rgba(255,255,255,0.28), transparent 50%)",
  "radial-gradient(1.4px 1.4px at 62% 8%, rgba(224,200,229,0.45), transparent 50%)",
  "radial-gradient(1px 1px at 80% 46%, rgba(255,255,255,0.30), transparent 50%)",
  "radial-gradient(1px 1px at 92% 78%, rgba(255,255,255,0.22), transparent 50%)",
  "radial-gradient(1.2px 1.2px at 44% 88%, rgba(224,200,229,0.32), transparent 50%)",
  "radial-gradient(1px 1px at 18% 92%, rgba(255,255,255,0.22), transparent 50%)",
  "radial-gradient(ellipse 620px 380px at 50% -4%, rgba(224,200,229,0.16), transparent 62%)",
  "radial-gradient(1200px 760px at 80% 0%, rgba(224,200,229,0.10), transparent 60%)",
  "radial-gradient(900px 700px at 6% 100%, rgba(170,140,200,0.06), transparent 60%)",
].join(", ");

// Comments inside this string ship in every message, so the reasoning lives out
// here instead.
//
// There is deliberately no webfont @import. A webfont is close to useless in an
// e-mail because most clients block remote CSS, and Apple Mail blocks remote
// content by default — which put a failing remote import at the top of the one
// stylesheet the dark theme depends on. The font stack falls back to Helvetica,
// which is what most recipients were seeing anyway.
//
// `color-scheme` tells a client that understands it not to apply its own
// inversion on top of these rules. A client that ignores it falls back to the
// opaque light theme, which survives its inversion on its own.
const darkModeCss = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }

@media (prefers-color-scheme: dark) {
  .email-bg   { background-color: #08070b !important; background-image: ${darkStarfield} !important; }
  .card       { background-color: #121115 !important; border-color: #2a292c !important; }
  .t-primary  { color: #ffffff !important; }
  .t-body     { color: #dcdcdc !important; }
  .t-muted    { color: #a3a3a3 !important; }
  .t-faint    { color: #8f8f8f !important; }
  .t-brand    { color: #efe3fe !important; }
  .t-num      { color: #c8a4ce !important; }
  .dev-link   { color: #9a9a9a !important; }
  .divider    { border-top-color: #2a292c !important; border-bottom-color: #2a292c !important; }
  .note-box   { background-color: #19181c !important; }
  .chip       { background-color: #2b272e !important; border-color: #4c444f !important; color: #f3e8f5 !important; }
  .cta        { background-color: #695f6c !important; border-color: #837d85 !important; color: #ffffff !important; }
  .alert-chip { background-color: #2b272b !important; border-color: #51484c !important; color: #f3e8ea !important; }
  .alert-note { border-left-color: #c0848f !important; }
  .code-block { background-color: #201f23 !important; color: #f3e8f5 !important; border-color: #2a292c !important; }
}

/*
  Outlook does not honour prefers-color-scheme. Instead it rewrites the colours
  itself and marks what it touched: [data-ogsc] on an element whose text colour
  it changed, [data-ogsb] on one whose background it changed. Targeting those
  attributes is the only way to tell it what we actually want. Other clients
  never set them, so these rules simply never match there.
*/
[data-ogsb] .card, .card[data-ogsb] { background-color: #121115 !important; border-color: #2a292c !important; }
[data-ogsb] .email-bg, .email-bg[data-ogsb] { background-color: #08070b !important; }
[data-ogsc] .t-primary, .t-primary[data-ogsc] { color: #ffffff !important; }
[data-ogsc] .t-body, .t-body[data-ogsc] { color: #dcdcdc !important; }
[data-ogsc] .t-muted, .t-muted[data-ogsc] { color: #a3a3a3 !important; }
[data-ogsc] .t-faint, .t-faint[data-ogsc] { color: #8f8f8f !important; }
[data-ogsc] .t-brand, .t-brand[data-ogsc] { color: #efe3fe !important; }
[data-ogsb] .note-box, .note-box[data-ogsb] { background-color: #19181c !important; }
[data-ogsb] .chip, .chip[data-ogsb] { background-color: #2b272e !important; border-color: #4c444f !important; }
[data-ogsc] .chip, .chip[data-ogsc] { color: #f3e8f5 !important; }
[data-ogsb] .alert-chip, .alert-chip[data-ogsb] { background-color: #2b272b !important; border-color: #51484c !important; }
[data-ogsc] .alert-chip, .alert-chip[data-ogsc] { color: #f3e8ea !important; }
[data-ogsb] .cta, .cta[data-ogsb] { background-color: #695f6c !important; border-color: #837d85 !important; }
[data-ogsc] .cta, .cta[data-ogsc] { color: #ffffff !important; }
[data-ogsb] .code-block, .code-block[data-ogsb] { background-color: #201f23 !important; }
[data-ogsc] .code-block, .code-block[data-ogsc] { color: #f3e8f5 !important; }

.brand-link:hover { opacity: 0.85; }
.dev-link:hover   { color: #e0c8e5 !important; }
.legal-link:hover { opacity: 0.8; }
.cta:hover        { background-color: #f5d3e5 !important; }
`;

/**
 * Which product the mail comes from. It decides the footer only — an account
 * security notice must not look like it came from Forms, and an event mail must
 * not send the reader to the Forms admin.
 */
export type Brand = "skylab" | "forms" | "account";

const brands: Record<Brand, { label: string; href: string }> = {
  skylab: { label: "SKY LAB", href: "https://yildizskylab.com" },
  forms: { label: "SKY LAB Forms", href: "https://forms.yildizskylab.com" },
  account: { label: "SKY LAB Hesap", href: "https://my.yildizskylab.com" },
};

export function Shell({
  preview,
  brand = "skylab",
  children,
}: {
  preview: string;
  brand?: Brand;
  children: React.ReactNode;
}) {
  return (
    <Html lang="tr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkModeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="email-bg"
        style={{ margin: 0, padding: 0, backgroundColor: colors.pageBg, fontFamily: fontStack }}
      >
        <table
          role="presentation"
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          border={0}
          className="email-bg"
          style={{ width: "100%", backgroundColor: colors.pageBg }}
        >
          <tbody>
            <tr>
              {/* bgcolor, not a CSS background: Gmail strips background-color
                  from <body> and <div>, and the HTML attribute is what survives.
                  React renders it fine but its types do not know it on <td>. */}
              <td
                align="center"
                className="email-bg"
                {...({ bgcolor: colors.pageBg } as React.TdHTMLAttributes<HTMLTableCellElement>)}
                style={{ padding: "48px 0" }}
              >
                <Container style={{ margin: "0 auto", maxWidth: "600px", padding: "0 24px" }}>
                  <Section style={{ marginTop: "8px", marginBottom: "32px", textAlign: "center" }}>
                    <Img src={LOGO} width="56" height="53" alt="SKY LAB" style={{ margin: "0 auto" }} />
                  </Section>

                  <Section
                    className="card"
                    style={{
                      borderRadius: "24px",
                      border: `1px solid ${colors.cardBorder}`,
                      backgroundColor: colors.cardBg,
                      padding: "40px 32px",
                    }}
                  >
                    {children}
                  </Section>

                  <Footer brand={brand} />
                </Container>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  // A <Text> rather than a <Heading>: react-email upper-cases headings in the
  // plain-text part, which would mangle a Go template action inside one.
  return (
    <Text
      className="t-primary"
      style={{
        margin: 0,
        textAlign: "left",
        fontSize: "24px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: "1.25",
        color: colors.textPrimary,
        fontFamily: fontStack,
      }}
    >
      {children}
    </Text>
  );
}

export function Paragraph({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <Text
      className="t-body"
      style={{
        marginTop: "14px",
        marginBottom: 0,
        textAlign: "left",
        fontSize: "15px",
        lineHeight: "1.75",
        color: colors.textBody,
        fontFamily: fontStack,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return (
    <strong className="t-primary" style={{ color: colors.textPrimary }}>
      {children}
    </strong>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="t-muted"
      style={{
        margin: 0,
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: colors.textMuted,
        fontFamily: fontStack,
      }}
    >
      {children}
    </Text>
  );
}

export function Chip({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "alert" }) {
  const alert = tone === "alert";
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" style={{ marginTop: "16px" }}>
      <tbody>
        <tr>
          <td
            className={alert ? "alert-chip" : "chip"}
            style={{
              padding: "5px 13px",
              borderRadius: "9999px",
              backgroundColor: alert ? colors.alertBg : "#ece3ef",
              border: `1px solid ${alert ? colors.alertBorder : colors.ctaBorder}`,
              color: alert ? colors.alertText : colors.skylab900,
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              fontFamily: fontStack,
              whiteSpace: "nowrap",
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  // A table-wrapped anchor rather than <Button>: Outlook ignores padding on an
  // inline-block, and the anchor keeps the label readable when images are off.
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" style={{ margin: "28px 0 0" }}>
      <tbody>
        <tr>
          <td
            className="cta"
            style={{
              borderRadius: "12px",
              backgroundColor: colors.ctaBg,
              border: `1.5px solid ${colors.ctaBorder}`,
            }}
          >
            <Link
              href={href}
              className="cta"
              style={{
                display: "inline-block",
                padding: "12px 32px",
                fontSize: "14px",
                fontWeight: 600,
                color: colors.skylab900,
                textDecoration: "none",
                fontFamily: fontStack,
              }}
            >
              {children}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** A fallback for the CTA: some clients strip buttons, and some people copy links. */
export function LinkFallback({ href }: { href: string }) {
  return (
    <Text
      className="t-faint"
      style={{
        marginTop: "18px",
        marginBottom: 0,
        fontSize: "12px",
        lineHeight: "1.7",
        color: colors.textFaint,
        wordBreak: "break-all",
        fontFamily: fontStack,
      }}
    >
      Buton çalışmazsa bu adresi tarayıcına yapıştır:
      <br />
      {href}
    </Text>
  );
}

export function DetailRow({ label, value, last }: { label: React.ReactNode; value: React.ReactNode; last?: boolean }) {
  return (
    <Row
      className="divider"
      style={{
        borderTop: `1px solid ${colors.divider}`,
        ...(last ? { borderBottom: `1px solid ${colors.divider}` } : {}),
      }}
    >
      <Column style={{ paddingTop: "12px", paddingBottom: "12px", verticalAlign: "top" }}>
        <Text
          className="t-muted"
          style={{
            margin: 0,
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: colors.textMuted,
            fontFamily: fontStack,
          }}
        >
          {label}
        </Text>
      </Column>
      <Column style={{ paddingTop: "12px", paddingBottom: "12px", textAlign: "right", verticalAlign: "top" }}>
        <Text
          className="t-primary"
          style={{
            margin: 0,
            textAlign: "right",
            fontSize: "14px",
            fontWeight: 500,
            color: colors.textPrimary,
            fontFamily: fontStack,
          }}
        >
          {value}
        </Text>
      </Column>
    </Row>
  );
}

export function Note({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "alert" }) {
  const alert = tone === "alert";
  return (
    <Section
      className={alert ? "note-box alert-note" : "note-box"}
      style={{
        marginTop: "12px",
        borderRadius: "12px",
        padding: "16px 20px",
        backgroundColor: colors.noteBg,
        borderLeft: `3px solid ${alert ? colors.alert : colors.skylab800}`,
      }}
    >
      <Text
        className="t-primary"
        style={{
          margin: 0,
          textAlign: "left",
          fontSize: "15px",
          lineHeight: "1.6",
          color: colors.textPrimary,
          fontFamily: fontStack,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

function Footer({ brand }: { brand: Brand }) {
  const { label, href } = brands[brand];
  return (
    <Section style={{ marginTop: "32px", textAlign: "center" }}>
      <table role="presentation" align="center" cellPadding="0" cellSpacing="0" style={{ margin: "0 auto" }}>
        <tbody>
          <tr>
            <td valign="middle" style={{ paddingRight: "7px", lineHeight: "0" }}>
              <Link href={href} className="brand-link t-brand" style={{ textDecoration: "none", color: colors.skylab800 }}>
                <Img src={LOGO} width="20" height="20" alt="SKY LAB" style={{ display: "inline-block", verticalAlign: "middle" }} />
              </Link>
            </td>
            <td valign="middle" style={{ paddingRight: "8px" }}>
              <Link href={href} className="brand-link" style={{ textDecoration: "none", color: colors.skylab800 }}>
                <span
                  className="t-brand"
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: colors.skylab800,
                    fontFamily: fontStack,
                  }}
                >
                  {label}
                </span>
              </Link>
            </td>
            <td valign="middle">
              <span className="t-faint" style={{ fontSize: "13px", color: colors.textFaint, fontFamily: fontStack }}>
                by WEBLAB
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <table role="presentation" align="center" cellPadding="0" cellSpacing="0" style={{ margin: "14px auto 0" }}>
        <tbody>
          <tr>
            <td valign="middle" style={{ padding: "0 10px" }}>
              <Link href="https://skyl.app/kvkk-metni" className="t-muted legal-link" style={{ fontSize: "11px", color: colors.textMuted, textDecoration: "none", fontFamily: fontStack }}>
                Kullanım Koşulları
              </Link>
            </td>
            <td valign="middle" style={{ lineHeight: "0" }}>
              <span style={{ display: "inline-block", width: "3px", height: "3px", borderRadius: "9999px", backgroundColor: colors.textFaint, verticalAlign: "middle" }} />
            </td>
            <td valign="middle" style={{ padding: "0 10px" }}>
              <Link href="https://skyl.app/kvkk-metni" className="t-muted legal-link" style={{ fontSize: "11px", color: colors.textMuted, textDecoration: "none", fontFamily: fontStack }}>
                Gizlilik Politikası
              </Link>
            </td>
            <td valign="middle" style={{ lineHeight: "0" }}>
              <span style={{ display: "inline-block", width: "3px", height: "3px", borderRadius: "9999px", backgroundColor: colors.textFaint, verticalAlign: "middle" }} />
            </td>
            <td valign="middle" style={{ padding: "0 10px" }}>
              <Link
                href="mailto:info@yildizskylab.com?subject=SKY%20LAB%20-%20Sorun%20Bildirimi"
                className="t-muted legal-link"
                style={{ fontSize: "11px", color: colors.textMuted, textDecoration: "none", fontFamily: fontStack }}
              >
                Sorun Bildir
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
