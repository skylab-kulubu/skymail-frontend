/**
 * The recipient's name in a send's own text: the merge tag every mail tool
 * has (Mailchimp's *|FNAME|*, SendGrid's {{first_name}}), read the way
 * skymail-backend fills it (internal/mailer/recipient_name.go). A send's
 * variables are data, never a template: the mailer prints `{{.Email}}` in a
 * free announcement as those characters. Exactly two tags are filled:
 *
 *  - `{{.FullName}}`: the recipient's name;
 *  - `{{or .FullName "katılımcı"}}`: the name, or the text in quotes when the
 *    recipient has none (FALLBACK_RULE) — the default value Mailchimp,
 *    HubSpot, Braze and Klaviyo give a merge tag. Without one an empty name
 *    prints nothing.
 *
 * Any other `{{…}}` stays text. The mailer fills them in the variables the
 * subject prints and those printed through safeHTML (free.basic's Subject and
 * BodyHtml), in markup only in text, escaped. The two repos hold the same
 * cases (testdata/recipient-name.json); the preview fills with these.
 */

/** The variable the mailer fills with the recipient's name. */
export const RECIPIENT_NAME = "FullName";

/** The tags in a text, a fallback in group 1. */
const TAG = /\{\{(?:\.FullName|or \.FullName "([^"\\{}<>&\p{Cc}]{1,60})")\}\}/gu;

/** One fallback as the tag holds it. */
const FALLBACK = /^[^"\\{}<>&\p{Cc}]{1,60}$/u;

export const FALLBACK_RULE = 'En çok 60 karakter; " \\ { } < > & kullanılmaz.';

/** What keeps `text` from being a tag's fallback, or null. An empty one is none. */
export function fallbackProblem(text: string): string | null {
  return text === "" || FALLBACK.test(text) ? null : `Bu metin ad yerine yazılamaz. ${FALLBACK_RULE}`;
}

/** The tag for the recipient's name, with a fallback when one is given. */
export function recipientNameTag(fallback = ""): string {
  return fallback === "" ? `{{.${RECIPIENT_NAME}}}` : `{{or .${RECIPIENT_NAME} "${fallback}"}}`;
}

/** A text and the tags in it, in order: what the editor reads back as the name. */
export type NamePiece = { text: string } | { tag: string; fallback: string };

export function splitRecipientNameTags(text: string): NamePiece[] {
  const pieces: NamePiece[] = [];
  let at = 0;
  for (const match of text.matchAll(TAG)) {
    if (match.index > at) pieces.push({ text: text.slice(at, match.index) });
    pieces.push({ tag: match[0], fallback: match[1] ?? "" });
    at = match.index + match[0].length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at) });
  return pieces;
}

/** Whether a text holds one of the tags. */
export const hasRecipientNameTag = (text: string): boolean => splitRecipientNameTags(text).some((piece) => "tag" in piece);

/** The name a tag prints: the full name with its white space and control characters made single spaces, trimmed. */
export function recipientName(fullName: string): string {
  return fullName
    .split(/[\s\p{Cc}]+/u)
    .filter((part) => part !== "")
    .join(" ");
}

/** `text` with its tags filled with `name` (recipientName), or each tag's fallback when it is empty. */
export function fillRecipientName(text: string, name: string): string {
  return text.replace(TAG, (_tag, fallback: string | undefined) => (name !== "" ? name : (fallback ?? "")));
}

/** What Go's html.EscapeString escapes, as it escapes it. */
const ESCAPES: ReadonlyMap<string, string> = new Map([
  ["&", "&amp;"],
  ["'", "&#39;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&#34;"],
  ["\r", "&#13;"],
]);

const escapeText = (text: string) => text.replace(/[&'<>"\r]/g, (c) => ESCAPES.get(c)!);

const NAMED: ReadonlyMap<string, string> = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", "\u00a0"],
]);

/** Character references as a browser reads them in text; one it does not know stays. */
function decodeText(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, name: string) => {
    if (name.startsWith("#")) {
      const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED.get(name) ?? whole;
  });
}

/** A tag, a comment, or the text between them. */
const MARKUP = /<!--[\s\S]*?-->|<[^>]*>|[^<]+|</g;

/**
 * Markup with the tags in its text filled, escaped: a free announcement's
 * body as the mailer fills it. A tag or an attribute — a link's address —
 * is never read; text without a tag is left as written.
 */
export function fillRecipientNameMarkup(markup: string, name: string): string {
  if (!markup.includes(".FullName")) return markup;
  let out = "";
  for (const [piece] of markup.matchAll(MARKUP)) {
    if (piece.startsWith("<")) {
      out += piece;
      continue;
    }
    const text = decodeText(piece);
    const filled = fillRecipientName(text, name);
    out += filled === text ? piece : escapeText(filled);
  }
  return out;
}

/** Whether markup's text holds one of the tags, read as the mailer reads it (escaped quotes and all). */
export function markupHasRecipientNameTag(markup: string): boolean {
  for (const [piece] of markup.matchAll(MARKUP)) {
    if (!piece.startsWith("<") && hasRecipientNameTag(decodeText(piece))) return true;
  }
  return false;
}
