/**
 * The shared layout every SKY LAB e-mail is built from.
 *
 * It follows SKY LAB Forms' mail layout (forms-frontend mail-templates/
 * _components/Layout.jsx) piece for piece, so a mail from SkyNotify and one from
 * Forms read as the same family: the same type, colours and tones, the small
 * logo and product name on top, a status line (Context) above the title, rows
 * of facts between hairlines, a quiet footer that says why the mail came.
 *
 * Three things make e-mail styling awkward and all are handled here so a
 * template author never has to think about them:
 *
 *  - Dark mode. Inline styles are the light theme, because that is what clients
 *    without `prefers-color-scheme` render. Role classes (.t-primary, .hair, …)
 *    carry the dark theme with `!important`, so a client that does understand
 *    the media query (Apple Mail, iOS Mail, Outlook for Mac) flips the whole
 *    mail at once. Outlook's own dark mode is reached through the attributes it
 *    marks what it recolours with ([data-ogsc], [data-ogsb]).
 *  - Backgrounds. Gmail strips `background-color` off `<body>` and off `<div>`,
 *    so the page background is painted on a full-width table with the `bgcolor`
 *    HTML attribute instead.
 *  - Outlook for Windows. Its Word engine ignores `max-width`, so the column
 *    gets a fixed width there from a table only it reads, and padding that it
 *    drops off a link is repeated as `mso-padding-alt`.
 *
 * Variables are Go templates rendered by skynotify-backend, not React props. A
 * template writes `{{.formTitle}}`; the mailer substitutes it per send. Missing
 * variables render as empty in HTML but as `<no value>` in the subject and the
 * plain-text part, so only ever put a variable in a subject when the sender is
 * guaranteed to supply it.
 *
 * Every export the earlier shell had (Heading, Chip, DetailRow, Label, …) is
 * still here with the same props, restyled: templates an operator wrote in the
 * panel's JSX mode import them by name and must keep compiling.
 */
import { Body, Head, Hr, Html, Img, Link, Preview } from "@react-email/components";
import * as React from "react";
import { elseBranch, end, ifSet, rangeOver, v } from "./go";

/** Forms' palette: the light theme, inline. */
const ink = {
  primary: "#171717",
  body: "#525252",
  muted: "#737373",
  faint: "#a3a3a3",
  hair: "#ebebeb",
  link: "#8f5e98",
  page: "#ffffff",
  surface: "#fafafa",
  border: "#e5e5e5",
} as const;

/** The status colours of Context's dot and of a few emphasised words. */
export const tones = {
  ok: "#059669",
  wait: "#d97706",
  bad: "#dc2626",
  neutral: "#a3a3a3",
  brand: "#ae7eb6",
} as const;

export type Tone = keyof typeof tones;

export const colors = {
  ...ink,
  // The club's purple scale, for a template that wants the brand colour.
  skylab300: "#f3e8f5",
  skylab400: "#ebd5ee",
  skylab500: "#e0c8e5",
  skylab600: "#c8a4ce",
  skylab700: "#ae7eb6",
  skylab800: "#8f5e98",
  skylab900: "#6e4576",
  // The names the earlier shell used, kept for templates written against it.
  // Every surface is opaque on purpose: a client that darkens a light e-mail by
  // itself darkens what is behind a translucent layer but leaves the layer.
  pageBg: ink.page,
  cardBg: ink.page,
  cardBorder: ink.border,
  textPrimary: ink.primary,
  textBody: ink.body,
  textMuted: ink.muted,
  textFaint: ink.faint,
  divider: ink.hair,
  noteBg: ink.surface,
  ctaBg: ink.surface,
  ctaBorder: ink.border,
  alert: tones.bad,
  alertBg: ink.surface,
  alertBorder: ink.border,
  alertText: tones.bad,
} as const;

/** The dark theme's page, which the stylesheet below paints; editors show images on it. */
export const darkColors = { cardBg: "#0a0a0a" } as const;

/*
  No webfont is loaded. Most clients block remote CSS, Gmail ignores webfonts
  altogether, and a font fetched from a third party tells it who opened the
  mail. Recipients who have Space Grotesk get it; everyone else gets their
  system's UI font, as most Forms recipients do too.
*/
export const fontStack = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const MONO = "'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/*
  PNGs, not the SVG the app uses: Gmail and Outlook do not render SVG. Two
  colours of the same mark, the ink one on light and the lilac one on dark,
  both served by the SkyNotify console's own site (public/mail/, open without a
  session; notify.yildizskylab.com since ADR-0090). The old iletisim. and mail.
  names are deleted, not redirected: mails sent before show no logo.
*/
const ASSETS = "https://notify.yildizskylab.com/mail";
const LOGO_INK = `${ASSETS}/skylab-ink.png`;
const LOGO_LILAC = `${ASSETS}/skylab-lilac.png`;

const REPORT = "mailto:info@yildizskylab.com?subject=SKY%20LAB%20-%20Sorun%20Bildirimi";
const KVKK = "https://yildizskylab.com/kvkk-metni.pdf";
/**
 * The Account center's communication preferences (core keeps them): which
 * club and team announcements reach the reader. Every footer but the account
 * mails' carries it (skynotify-backend bounce ticket 11): a mail to many always
 * shows a way to its preferences, and account mails go whatever they say.
 */
const PREFERENCES = "https://my.yildizskylab.com/communication-preferences";
/**
 * The recipient's own unsubscribe link, which SkyNotify passes to a mail of the
 * duyuru stream when the row has one (ADR 0072; abonelik-cikisi 05). Account
 * and transactional mails get none, so the footer shows the link only when
 * it is set. Not a Required variable: an empty one is the usual case.
 */
const UNSUBSCRIBE_URL = "UnsubscribeUrl";

// Comments inside this string ship in every message, so the reasoning lives out
// here instead.
//
// `color-scheme` tells a client that understands it not to apply its own
// inversion on top of these rules. A client that ignores it falls back to the
// opaque light theme, which survives its inversion on its own.
//
// The page colour lives here rather than inline on <Body>: react-email copies
// an inline background from <Body> onto a wrapper cell it generates itself, and
// that cell carries no class, so it would stay light in dark mode.
//
// The free-form body is the one place markup comes from the sender, so its
// links are plain <a> with nothing on them; the server's allowlist drops style
// and class inside that body, so their colour can only come from here. The
// same holds for a News record's body (club.news), which may also carry
// <pre>, <code> and <hr>: a long line wraps instead of widening the column
// on a phone.
const css = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin: 0; padding: 0; background-color: ${ink.page}; }
.free-body a { color: ${ink.link}; }
.free-body p { margin: 12px 0 0; }
.free-body p:first-child { margin-top: 0; }
.free-body pre { margin: 12px 0 0; padding: 12px; background-color: ${ink.surface}; border-radius: 8px; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 20px; }
.free-body code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; word-break: break-word; overflow-wrap: anywhere; }
.free-body hr { margin: 20px 0 0; border: none; border-top: 1px solid ${ink.hair}; }

@media (prefers-color-scheme: dark) {
  .email-bg   { background-color: #0a0a0a !important; }
  .t-primary  { color: #fafafa !important; }
  .t-body     { color: #a3a3a3 !important; }
  .t-muted    { color: #8a8a8a !important; }
  .t-faint    { color: #6b6b6b !important; }
  .t-link     { color: #ebd5ee !important; }
  .hair       { border-color: #262626 !important; }
  .note       { border-left-color: #404040 !important; }
  .note-alert { border-left-color: #f87171 !important; }
  .card, .chip, .code-block { background-color: #141414 !important; border-color: #262626 !important; }
  .tone-ok      { color: #34d399 !important; }
  .tone-wait    { color: #fbbf24 !important; }
  .tone-bad     { color: #fca5a5 !important; }
  .tone-neutral { color: #6b6b6b !important; }
  .tone-brand   { color: #ebd5ee !important; }
  .logo-light { display: none !important; }
  .logo-dark  { display: inline-block !important; max-height: none !important; }
  .free-body a { color: #ebd5ee !important; }
  .free-body pre { background-color: #141414 !important; }
  .free-body hr { border-top-color: #262626 !important; }
}

[data-ogsb] .email-bg, .email-bg[data-ogsb] { background-color: #0a0a0a !important; }
[data-ogsb] .card, .card[data-ogsb], [data-ogsb] .chip, .chip[data-ogsb], [data-ogsb] .code-block, .code-block[data-ogsb] { background-color: #141414 !important; border-color: #262626 !important; }
[data-ogsc] .t-primary, .t-primary[data-ogsc] { color: #fafafa !important; }
[data-ogsc] .t-body, .t-body[data-ogsc] { color: #a3a3a3 !important; }
[data-ogsc] .t-muted, .t-muted[data-ogsc] { color: #8a8a8a !important; }
[data-ogsc] .t-faint, .t-faint[data-ogsc] { color: #6b6b6b !important; }
[data-ogsc] .t-link, .t-link[data-ogsc] { color: #ebd5ee !important; }
[data-ogsc] .free-body a { color: #ebd5ee !important; }

@media (max-width: 480px) {
  .shell { padding: 28px 20px 24px !important; }
  .foot-cell { display: block !important; width: 100% !important; text-align: left !important; padding-left: 0 !important; }
  .foot-credit { padding-top: 0 !important; padding-bottom: 6px !important; }
}
`;

/*
  Outlook for Windows ignores max-width, so it gets the column as a fixed-width
  "ghost" table that only it sees: conditional comments, which it reads and
  every other client skips. React cannot write a comment, so each half travels
  as the inner HTML of an empty <div>, the way react-email's own Button carries
  its Outlook spacing. The halves are not balanced markup on their own, which
  is also what keeps the HTML formatter from reflowing them.
*/
const OUTLOOK_COLUMN_OPEN = '<!--[if mso]><table role="presentation" width="520" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->';
const OUTLOOK_COLUMN_CLOSE = "<!--[if mso]></td></tr></table><![endif]-->";

/**
 * Which product the mail comes from. It decides the name beside the logo and
 * in the footer: an account security notice must not look like it came from
 * Forms, and an approval request comes from SkyNotify itself.
 */
export type Brand = "skylab" | "forms" | "account" | "mail";

/** Who built a product, for the footer's "Developed by"; no href prints the name alone. */
interface Developer {
  name: string;
  href?: string;
}

/** A credit line of the footer: "<product> by WEBLAB" on the left, "Developed by …" on the right. */
interface Credit {
  product: string;
  href: string;
  developer: Developer;
}

/** SkyNotify sends and renders every mail, so every mail ends with its line. */
const SKYNOTIFY: Credit = {
  product: "SkyNotify",
  href: "https://notify.yildizskylab.com",
  developer: { name: "Enes Genç", href: "https://enesgenc.dev" },
};

/**
 * The product a mail comes from: its name beside the logo and, for a product
 * with a credit of its own, a line above SkyNotify's (Yusuf, 2026-10-13).
 *
 *  - account: the account product is e-skylab (Keycloak's sign-in pages and
 *    the account mails), in lower case as its sign-in pages write it.
 *  - forms: credited as Forms' own mails are.
 *  - mail: SkyNotify's own mails; SkyNotify's line says it all.
 *  - skylab: the club's own mails; SKY LAB is the club, not a product.
 */
const brands: Record<Brand, { label: string; href: string; credit?: Credit }> = {
  skylab: { label: "SKY LAB", href: "https://yildizskylab.com" },
  forms: {
    label: "SKY LAB Forms",
    href: "https://forms.yildizskylab.com",
    credit: { product: "SKY LAB Forms", href: "https://forms.yildizskylab.com", developer: { name: "Fatih Naz", href: "https://github.com/fatiihnaz" } },
  },
  account: {
    label: "e-skylab",
    href: "https://e.yildizskylab.com",
    credit: {
      product: "e-skylab",
      href: "https://e.yildizskylab.com",
      developer: { name: "Yusuf Açmacı", href: "https://www.linkedin.com/in/yusuf-acmaci/" },
    },
  },
  mail: { label: "SkyNotify", href: "https://notify.yildizskylab.com" },
};

/**
 * The footer's sentence for a mail that does not say its own: a Visual mail
 * whose document gives no reason, and a JSX template that passes none. It claims
 * nothing about the reader, because an operator's list may reach people who
 * are neither members nor participants (a sponsor, an applicant).
 */
const NEUTRAL_REASON = "Bu e-postayı SKY LAB'den aldın.";

/** The footer's sentence a mail gets when it does not say its own; the same for every brand. */
export const defaultReason = () => NEUTRAL_REASON;

/** A presentation table: the only layout every client, Outlook included, agrees on. */
function Table({ children, style, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ width: "100%", ...style }} {...props}>
      <tbody>{children}</tbody>
    </table>
  );
}

/** Attributes React renders but its types do not know on these elements. */
const legacy = (attributes: Record<string, string>) => attributes as React.HTMLAttributes<HTMLElement>;

function BrandMark({ brand }: { brand: Brand }) {
  const { label, href } = brands[brand];
  // The footer names the product again with its link, so the plain-text part
  // skips this and starts with what the mail says. The logo is not a link: a
  // link with no text renders there as a bare URL glued to what follows.
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" border={0} data-skip-in-text="true">
      <tbody>
        <tr>
          <td style={{ paddingRight: "8px", lineHeight: 0 }}>
            <Img className="logo-light" src={LOGO_INK} width="20" height="19" alt="SKY LAB" style={{ display: "inline-block", border: 0 }} />
            <Img
              className="logo-dark"
              src={LOGO_LILAC}
              width="20"
              height="19"
              alt=""
              style={{ display: "none", maxHeight: 0, overflow: "hidden", border: 0, msoHide: "all" } as React.CSSProperties}
            />
          </td>
          <td>
            <a
              href={href}
              className="t-primary"
              style={{ fontSize: "13px", lineHeight: "19px", fontWeight: 600, color: ink.primary, textDecoration: "none", fontFamily: fontStack }}
            >
              {label}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Footer({ brand, reason, sender }: { brand: Brand; reason: React.ReactNode; sender?: React.ReactNode }) {
  const { credit } = brands[brand];
  // Muted, not Forms' faint: the reason and the credit are text to read, and
  // faint is 2.5:1 on white (WCAG AA asks 4.5:1); muted is 4.7:1, 5.7:1 dark.
  const small = { margin: 0, fontSize: "12px", lineHeight: "18px", color: ink.muted, fontFamily: fontStack };
  const quiet = { color: ink.muted, textDecoration: "none" };
  const hasReason = reason !== null && reason !== false && reason !== "";
  return (
    <div style={{ marginTop: "48px" }}>
      {hasReason ? (
        <p className="t-muted" style={small}>
          {reason}
        </p>
      ) : null}
      {sender ? (
        <p className="t-muted" style={hasReason ? { ...small, margin: "8px 0 0" } : small}>
          {sender}
        </p>
      ) : null}
      <p className="t-muted" style={hasReason || sender ? { ...small, margin: "8px 0 0" } : small}>
        <a href={REPORT} className="t-muted" style={quiet}>
          Sorun bildir
        </a>
        {"  ·  "}
        <a href={KVKK} className="t-muted" style={quiet}>
          KVKK metni
        </a>
        {brand === "account" ? null : (
          <>
            {"  ·  "}
            {ifSet(UNSUBSCRIBE_URL)}
            <a href={v(UNSUBSCRIBE_URL)} className="t-muted" style={quiet}>
              Abonelikten çık
            </a>
            {"  ·  "}
            {end}
            <a href={PREFERENCES} className="t-muted" style={quiet}>
              İletişim tercihleri
            </a>
          </>
        )}
      </p>
      <div style={{ marginTop: "24px" }}>
        {credit ? <CreditLine credit={credit} /> : null}
        <CreditLine credit={SKYNOTIFY} />
      </div>
    </div>
  );
}

/**
 * One credit line, its two cells side by side; on a narrow screen they stack
 * (.foot-cell), and each phrase keeps its words together.
 */
function CreditLine({ credit: { product, href, developer } }: { credit: Credit }) {
  const cell: React.CSSProperties = { fontSize: "11px", lineHeight: "16px", color: ink.muted, fontFamily: fontStack, verticalAlign: "top", paddingTop: "4px" };
  const link = { color: ink.muted, textDecoration: "none" };
  return (
    <Table>
      <tr>
        <td className="t-muted foot-cell" style={cell}>
          <span style={{ whiteSpace: "nowrap" }}>
            <a href={href} className="t-muted" style={{ ...link, fontWeight: 600 }}>
              {product}
            </a>
            {" by WEBLAB "}
          </span>
        </td>
        <td align="right" className="t-muted foot-cell foot-credit" style={{ ...cell, paddingLeft: "12px", textAlign: "right" }}>
          <span style={{ whiteSpace: "nowrap" }}>
            {/* One string, so React writes no <!-- --> between its parts. */}
            {developer.href ? (
              <a href={developer.href} className="t-muted" style={link}>
                {`Developed by ${developer.name}`}
              </a>
            ) : (
              `Developed by ${developer.name}`
            )}
          </span>
        </td>
      </tr>
    </Table>
  );
}

/** React Email's Preview cuts its text at this many characters. */
const PREVIEW_LIMIT = 150;

/** What Preview pads a short text with, so the inbox line does not run on into the body. */
const PREVIEW_FILL = "\xa0\u200c".repeat(90);

/**
 * The inbox line. React Email's Preview cuts its text at 150 characters, which
 * is right for a written sentence but cuts a Go-templated one (Forms' previews
 * branch on a status) in the middle of an action, leaving an {{if}} without
 * its {{end}}. A longer text goes whole, in the same hidden block, padded as
 * Forms pads it: the sentence it renders to is short again.
 */
function InboxPreview({ text }: { text: string }) {
  if (text.length <= PREVIEW_LIMIT) {
    return <Preview>{text}</Preview>;
  }
  return (
    <div
      data-skip-in-text="true"
      style={{ display: "none", overflow: "hidden", lineHeight: "1px", opacity: 0, maxHeight: 0, maxWidth: 0 }}
    >
      {text}
      <div>{PREVIEW_FILL}</div>
    </div>
  );
}

/*
  The event's theme (etkinlik teması, plan §3.3): the look its organisers chose
  for the event, kept in core and sent with each participant mail as two
  variables: Theme, the theme's key (empty for the club's own look), and
  EventBannerUrl, the public address of the event's banner (its ticket image;
  empty when it has none). Today's themes: none and "artlab".

  A mail opts in with <Shell themed>: the participant mails (ticket,
  reminder, cancellation, change, certificate, feedback, the door's welcome
  and receipt). Go chooses per
  send: for any other theme, and from a core that sends no Theme at all, every
  {{if}} … {{end -}} of the theme drops out and the mail is the same bytes as
  before. `and` guards the `eq`: Go's eq fails on a variable the send does not
  carry. Colours are written out per theme rather than sent as variables:
  html/template filters a value in CSS, and a theme's look lives in code.

  The theme changes the frame, never the content: a band above the body (the
  banner, or the theme's written band without one) and the accent of links,
  of the brand-toned status line and of the action button, through a
  stylesheet of its own. A client that drops <style> keeps the club's colours;
  the band is inline and shows everywhere. No webfont: the theme's display
  face (Unbounded) is not one a reader has, as the shell's own note says.
*/

/** The variables core sends for the event's theme (core T3). */
export const THEME = "Theme";
export const EVENT_BANNER_URL = "EventBannerUrl";

/** The ARTLAB theme's condition. Backquoted strings, as ifEq writes them: React writes a double quote in text as &quot;. */
export const ifArtlabTheme = `{{if and .${THEME} (eq .${THEME} \`artlab\`)}}`;

/*
  The theme's end trims the white space after it. The formatter puts an {{if}}
  where the next element began, on that element's line and indent, so with
  the theme's part dropped and the space after {{end}} trimmed, the body and
  the plain text are byte for byte what they were without it.
*/
const END_TRIMMED = "{{end -}}";

/**
 * ARTLAB's palette: the poster's (Yusuf, 2026-11-26), on every surface of the
 * theme. Navy ground, orange accent, electric blue second accent. On white
 * the orange is darkened for text: #b35600 is 4.9:1 on white (4.7:1 on the
 * button's #fafafa); #ff8a1f, 2.4:1 there, is for the dark ground (7.9:1).
 */
const artlab = { ground: "#0a1222", surface: "#121c30", ink: "#e9edf2", orange: "#ff8a1f", orangeOnWhite: "#b35600", blue: "#3aa0ff" } as const;

/*
  Each rule is scoped under .email-bg, the page's own wrapper, so it outweighs
  the shell's rules for the same class whatever their order: the theme's sheet
  comes before the shell's in the <head>, where its {{end}} leaves the shell's
  bytes as they were.
*/
const artlabCss = `
.email-bg .t-link, .email-bg .tone-brand { color: ${artlab.orangeOnWhite} !important; }
.email-bg .card { border-color: ${artlab.orange} !important; }
@media (prefers-color-scheme: dark) {
  .email-bg .t-link, .email-bg .tone-brand { color: ${artlab.orange} !important; }
  .email-bg .card { background-color: ${artlab.surface} !important; border-color: ${artlab.orange} !important; }
  .email-bg .artlab-ground { background-color: ${artlab.ground} !important; }
}
[data-ogsc] .email-bg .t-link, [data-ogsc] .email-bg .tone-brand, .email-bg .t-link[data-ogsc] { color: ${artlab.orange} !important; }
[data-ogsb] .email-bg .card, .email-bg .card[data-ogsb] { background-color: ${artlab.surface} !important; }
[data-ogsb] .email-bg .artlab-ground, .email-bg .artlab-ground[data-ogsb] { background-color: ${artlab.ground} !important; }
`;

/** The theme's stylesheet. */
function ThemeStyle() {
  return (
    <>
      {ifArtlabTheme}
      <style>{artlabCss}</style>
      {END_TRIMMED}
    </>
  );
}

/**
 * The theme's band, first in the body: the event's banner on the theme's
 * ground, or the written band (the theme's name over the event's) without
 * one. The banner's alt text is the event's name, so with images off the
 * band still reads. The plain text leaves the band out; the mail names the
 * event in its rows.
 */
function ThemeBand() {
  const ground = { ...legacy({ bgcolor: artlab.ground }), className: "email-bg artlab-ground" };
  return (
    <>
      {ifArtlabTheme}
      <Table data-skip-in-text="true">
        <tr>
          <td style={{ paddingBottom: "28px" }}>
            <Table>
              <tr>
                {/* email-bg is the dark-aware class; artlab-ground, in the theme's sheet, keeps the band navy in dark mode too. */}
                <td
                  align="center"
                  {...ground}
                  style={{ backgroundColor: artlab.ground, borderRadius: "8px", color: artlab.ink, fontFamily: fontStack }}
                >
                  {ifSet(EVENT_BANNER_URL)}
                  {/* Width only: the banner's proportions are the event's. fetchPriority low keeps React from
                      preloading it in the <head>, outside the {{if}}, which every mail would carry. */}
                  <Img
                    src={v(EVENT_BANNER_URL)}
                    width="472"
                    alt={v("EventName")}
                    fetchPriority="low"
                    style={{
                      display: "block",
                      width: "100%",
                      maxWidth: "472px",
                      height: "auto",
                      border: 0,
                      borderRadius: "8px",
                      color: artlab.ink,
                      fontFamily: fontStack,
                      fontSize: "15px",
                      fontWeight: 600,
                      lineHeight: "22px",
                      textAlign: "center",
                    }}
                  />
                  {elseBranch}
                  <Table>
                    <tr>
                      <td
                        align="center"
                        {...ground}
                        style={{
                          backgroundColor: artlab.ground,
                          borderRadius: "8px",
                          borderBottom: `2px solid ${artlab.blue}`,
                          padding: "22px 20px 20px",
                          fontFamily: fontStack,
                          textAlign: "center",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: "22px", lineHeight: "28px", fontWeight: 700, letterSpacing: "4px", color: artlab.orange, fontFamily: fontStack }}>
                          ARTLAB
                        </p>
                        <p style={{ margin: "6px 0 0", fontSize: "14px", lineHeight: "20px", fontWeight: 600, color: artlab.ink, fontFamily: fontStack }}>
                          {v("EventName")}
                        </p>
                      </td>
                    </tr>
                  </Table>
                  {end}
                </td>
              </tr>
            </Table>
          </td>
        </tr>
      </Table>
      {END_TRIMMED}
    </>
  );
}

export function Shell({
  preview,
  brand = "skylab",
  reason,
  sender,
  themed = false,
  children,
}: {
  preview: string;
  brand?: Brand;
  /**
   * Why the reader got this mail, in one sentence; the footer opens with it.
   * Left out, the footer says the neutral sentence (operator-written mails);
   * null leaves the line out, as the account and notice mails do (Yusuf,
   * 2026-10-19: no explanatory sentences in those mails).
   */
  reason?: React.ReactNode | null;
  /**
   * Who sends it and how to reach them, for a mail to many (club.news, bilet
   * 06): a line under the reason. Left out, the footer has none.
   */
  sender?: React.ReactNode;
  /**
   * Whether the event's theme frames the mail (Theme, EventBannerUrl): the
   * participant mails of an event. Left out, the mail is the club's look alone.
   */
  themed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Html lang="tr" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="x-apple-disable-message-reformatting" />
        {themed ? <ThemeStyle /> : null}
        <style>{css}</style>
      </Head>
      <InboxPreview text={preview} />
      <Body className="email-bg" style={{ margin: 0, padding: 0, fontFamily: fontStack }}>
        <Table className="email-bg" {...legacy({ bgcolor: ink.page })} style={{ backgroundColor: ink.page }}>
          <tr>
            {/* bgcolor, not only a CSS background: Gmail strips background-color
                from <body> and <div>, and the HTML attribute is what survives. */}
            <td align="center" className="email-bg" {...legacy({ bgcolor: ink.page })} style={{ backgroundColor: ink.page }}>
              <div dangerouslySetInnerHTML={{ __html: OUTLOOK_COLUMN_OPEN }} />
              <Table align="center" style={{ maxWidth: "520px", margin: "0 auto" }}>
                <tr>
                  <td className="shell" style={{ padding: "40px 24px 32px", fontFamily: fontStack, textAlign: "left" }}>
                    <BrandMark brand={brand} />
                    <div style={{ paddingTop: "32px" }}>
                      {themed ? <ThemeBand /> : null}
                      {children}
                    </div>
                    <Footer brand={brand} reason={reason === undefined ? defaultReason() : reason} sender={sender} />
                  </td>
                </tr>
              </Table>
              <div dangerouslySetInnerHTML={{ __html: OUTLOOK_COLUMN_CLOSE }} />
            </td>
          </tr>
        </Table>
      </Body>
    </Html>
  );
}

/**
 * The line above the title: what the mail is about, with a dot in the colour
 * of how it went. The dot is decoration, so the plain text leaves it out.
 */
export function Context({ tone = "brand", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <p className="t-muted" style={{ margin: 0, fontSize: "13px", lineHeight: "20px", color: ink.muted, fontFamily: fontStack }}>
      <span
        className={`tone-${tone}`}
        aria-hidden="true"
        data-skip-in-text="true"
        style={{ color: tones[tone], fontSize: "10px", lineHeight: "20px", paddingRight: "6px" }}
      >
        ●
      </span>
      {children}
    </p>
  );
}

/*
  A <p> with the heading role rather than an <h1>: react-email's plain text
  upper-cases a heading, which reads as shouting and gets Turkish wrong
  ("i" → "I"). Screen readers still announce it as the mail's heading.
*/
const titleStyle: React.CSSProperties = {
  fontSize: "22px",
  lineHeight: "30px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: ink.primary,
  fontFamily: fontStack,
};

/** The mail's title, under its Context. */
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <p role="heading" aria-level={1} className="t-primary" style={{ margin: "6px 0 0", ...titleStyle }}>
      {children}
    </p>
  );
}

/** A title with no Context above it; `spaced` gives one further down the mail room above it. */
export function Heading({ children, spaced }: { children: React.ReactNode; spaced?: boolean }) {
  return (
    <p role="heading" aria-level={1} className="t-primary" style={{ margin: spaced ? "28px 0 0" : 0, ...titleStyle }}>
      {children}
    </p>
  );
}

export function Paragraph({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p className="t-body" style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "24px", color: ink.body, fontFamily: fontStack, ...style }}>
      {children}
    </p>
  );
}

/** A quieter sentence: an expiry, what to do if this was not you. Muted, not faint, so it stays readable. */
export function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p className="t-muted" style={{ margin: "16px 0 0", fontSize: "13px", lineHeight: "20px", color: ink.muted, fontFamily: fontStack, ...style }}>
      {children}
    </p>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return (
    <strong className="t-primary" style={{ color: ink.primary, fontWeight: 500 }}>
      {children}
    </strong>
  );
}

/** Italic inside running text; it keeps the colour of the text around it. */
export function Em({ children }: { children: React.ReactNode }) {
  return <em>{children}</em>;
}

/** A word in a status colour inside running text. */
export function Toned({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`tone-${tone}`} style={{ color: tones[tone] }}>
      {children}
    </span>
  );
}

/** A link inside running text, in the brand colour both themes read. */
export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="t-link" style={{ color: ink.link, textDecoration: "underline" }}>
      {children}
    </Link>
  );
}

/**
 * An image in the body. It has no background of its own: a transparent PNG
 * sits on the page in either theme, while one with a white background stays a
 * white block in the dark theme. PNG or JPG only — Gmail and Outlook do not
 * show SVG.
 */
export function Figure({ src, alt, width }: { src: string; alt: string; width?: number }) {
  return (
    <div style={{ marginTop: "24px" }}>
      <Img
        src={src}
        alt={alt}
        width={width}
        style={{
          display: "block",
          ...(width === undefined ? { width: "100%" } : { maxWidth: "100%" }),
          height: "auto",
          borderRadius: "8px",
        }}
      />
    </div>
  );
}

/** A hairline between two parts of the body; the plain text draws it as a rule. */
export function Divider() {
  return <Hr className="hair" style={{ margin: "28px 0 0", border: "none", borderTop: `1px solid ${ink.hair}` }} />;
}

/** A small caption over a value that stands on its own (a code, a number). */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="t-muted" style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: ink.muted, fontFamily: fontStack }}>
      {children}
    </p>
  );
}

/** A short tag; the layout's own way is a Context line above the title. */
export function Chip({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "alert" }) {
  const alert = tone === "alert";
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" border={0} style={{ marginTop: "12px" }}>
      <tbody>
        <tr>
          <td
            className={`chip ${alert ? "tone-bad" : "t-muted"}`}
            style={{
              padding: "3px 10px",
              borderRadius: "9999px",
              backgroundColor: ink.surface,
              border: `1px solid ${ink.border}`,
              color: alert ? tones.bad : ink.muted,
              fontSize: "12px",
              lineHeight: "18px",
              fontWeight: 500,
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

/**
 * The one action of a mail: a full-width row with an arrow, as Forms draws it.
 * One link, so a screen reader hears it once and the plain text prints its
 * address once; the arrow is decoration.
 */
export function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Table style={{ marginTop: "28px", borderCollapse: "separate" }}>
      <tr>
        <td
          className="card"
          style={{ border: `1px solid ${ink.border}`, borderRadius: "8px", backgroundColor: ink.surface, padding: 0, msoPaddingAlt: "13px 16px" } as React.CSSProperties}
        >
          <a
            href={href}
            className="t-primary"
            style={{
              display: "block",
              padding: "13px 16px",
              fontSize: "14px",
              lineHeight: "20px",
              fontWeight: 500,
              color: ink.primary,
              textDecoration: "none",
              fontFamily: fontStack,
            }}
          >
            {/* Floated first so it sits at the right end; Outlook for Windows
                cannot float and would print it before the label, so it hides it. */}
            <span
              className="t-link"
              aria-hidden="true"
              data-skip-in-text="true"
              style={{ float: "right", paddingLeft: "12px", color: ink.link, fontWeight: 400, msoHide: "all" } as React.CSSProperties}
            >
              →
            </span>
            {children}
          </a>
        </td>
      </tr>
    </Table>
  );
}

/** A fallback for the action: some clients strip it, and some people copy links. */
export function LinkFallback({ href }: { href: string }) {
  return (
    <p className="t-muted" style={{ margin: "16px 0 0", fontSize: "12px", lineHeight: "18px", color: ink.muted, wordBreak: "break-all", fontFamily: fontStack }}>
      Buton çalışmazsa bu adresi tarayıcına yapıştır:
      <br />
      {href}
    </p>
  );
}

/** Facts in rows between hairlines: RowItem for each, RowsEnd to close. */
export function Rows({ children }: { children: React.ReactNode }) {
  return <Table style={{ marginTop: "24px", borderCollapse: "collapse" }}>{children}</Table>;
}

const cell: React.CSSProperties = {
  borderTop: `1px solid ${ink.hair}`,
  padding: "10px 0",
  verticalAlign: "top",
};

const cellText: React.CSSProperties = { margin: 0, fontSize: "13px", lineHeight: "20px", fontFamily: fontStack };

// Each side is a <p>: the plain-text part joins table cells with nothing
// between them, and a block keeps the label and its value on lines of their own.
export function RowItem({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr>
      <td className="hair" style={cell}>
        <p className="t-muted" style={{ ...cellText, color: ink.muted }}>
          {label}
        </p>
      </td>
      <td className="hair" align="right" style={{ ...cell, padding: "10px 0 10px 16px", textAlign: "right" }}>
        {/* break-word lets a long UUID or address wrap at any character, and
            unlike overflow-wrap alone it also narrows the cell, so the table
            cannot grow past a 320 px screen. */}
        <p
          className="t-primary"
          style={{ ...cellText, color: ink.primary, fontWeight: 500, textAlign: "right", wordBreak: "break-word", overflowWrap: "break-word" }}
        >
          {children}
        </p>
      </td>
    </tr>
  );
}

export function RowsEnd() {
  return (
    <tr>
      <td colSpan={2} className="hair" style={{ borderTop: `1px solid ${ink.hair}`, fontSize: 0, lineHeight: 0, height: "1px" }}>
        &nbsp;
      </td>
    </tr>
  );
}

/** One row on its own, for a template written against the earlier shell; Rows + RowItem is the layout's way. */
export function DetailRow({ label, value, last }: { label: React.ReactNode; value: React.ReactNode; last?: boolean }) {
  return (
    <Table style={{ borderCollapse: "collapse" }}>
      <RowItem label={label}>{value}</RowItem>
      {last ? <RowsEnd /> : null}
    </Table>
  );
}

/**
 * A quoted note: someone's words, or the one warning a mail carries. `label`
 * names it; `empty` greys the text when there was nothing to quote;
 * `keepLines` keeps the line breaks of a note someone typed in several lines.
 */
export function Note({
  children,
  tone = "brand",
  label,
  empty = false,
  keepLines = false,
}: {
  children: React.ReactNode;
  tone?: "brand" | "alert";
  label?: React.ReactNode;
  empty?: boolean;
  keepLines?: boolean;
}) {
  const alert = tone === "alert";
  return (
    <Table style={{ marginTop: "24px" }}>
      <tr>
        <td
          className={alert ? "note-alert" : "note"}
          style={{ borderLeft: `2px solid ${alert ? tones.bad : ink.border}`, paddingLeft: "12px", fontFamily: fontStack }}
        >
          {label ? (
            <p className="t-muted" style={{ margin: "0 0 2px", fontSize: "12px", lineHeight: "18px", color: ink.muted }}>
              {label}
            </p>
          ) : null}
          <p
            className={empty ? "t-faint" : "t-primary"}
            style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: empty ? ink.faint : ink.primary, ...(keepLines ? { whiteSpace: "pre-wrap" } : {}) }}
          >
            {children}
          </p>
        </td>
      </tr>
    </Table>
  );
}

/** A value to read or type exactly: a code, an error. `size` is the type size in pixels. */
export function CodeBlock({ children, size = 13, center = false }: { children: React.ReactNode; size?: number; center?: boolean }) {
  const big = size >= 20;
  return (
    <Table style={{ marginTop: "8px", borderCollapse: "separate" }}>
      <tr>
        <td
          className="code-block t-primary"
          align={center ? "center" : "left"}
          style={{
            border: `1px solid ${ink.border}`,
            borderRadius: "8px",
            backgroundColor: ink.surface,
            padding: big ? "16px 20px" : "10px 14px",
            fontSize: `${size}px`,
            lineHeight: big ? "1.2" : "1.6",
            fontWeight: big ? 600 : 400,
            letterSpacing: big ? "6px" : "normal",
            color: ink.primary,
            fontFamily: MONO,
            textAlign: center ? "center" : "left",
            wordBreak: "break-all",
          }}
        >
          {children}
        </td>
      </tr>
    </Table>
  );
}

/** The heading of a list, with its count on the right. */
export function ListHeader({ title, count }: { title: React.ReactNode; count?: React.ReactNode }) {
  return (
    <Table style={{ marginTop: "32px" }}>
      <tr>
        <td className="t-primary" style={{ paddingBottom: "8px", fontSize: "13px", lineHeight: "20px", fontWeight: 500, color: ink.primary, fontFamily: fontStack }}>
          {title}
          {/* Does not show in the cell; keeps the plain text from reading "Formlar2 form". */}
          {" "}
        </td>
        <td className="t-muted" align="right" style={{ paddingBottom: "8px", fontSize: "12px", lineHeight: "20px", color: ink.muted, textAlign: "right", fontFamily: fontStack }}>
          {count}
        </td>
      </tr>
    </Table>
  );
}

/**
 * The organizer's announcement in the ticket mails (event.ticket-created,
 * event.waitlist-promoted, event.reminder): the event's WhatsApp group, say.
 * core sends TicketNote, the note as written (at most 500 characters, line
 * breaks kept), and TicketNoteParts, [{Text, Url}], the same text cut at its
 * https addresses, Url empty for plain text (core-backend docs/ticket-note.md;
 * Yusuf, 2026-11-26). An http address stays text. Empty, the section is not
 * there; a core that sends neither leaves it out too.
 */
export function TicketNote() {
  return (
    <>
      {ifSet("TicketNote")}
      <Note label="Duyuru" keepLines>
        {rangeOver("TicketNoteParts")}
        {ifSet("Url")}
        <TextLink href={v("Url")}>{v("Text")}</TextLink>
        {elseBranch}
        {v("Text")}
        {end}
        {end}
      </Note>
      {end}
    </>
  );
}
