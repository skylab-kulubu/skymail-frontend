/**
 * The allow-list skymail-backend narrows a free announcement's body to
 * (internal/mailer/sanitize.go: bluemonday, applied by the mailer's
 * `safeHTML`), reimplemented so the panel knows what the server keeps: the
 * send form previews the body as the server will write it, and the body
 * renderer's tests hold its output against it (free-body.test.ts).
 *
 * The server is the gate; this is its likeness, never a second gate. It is
 * held to the real thing by testdata/server-allowlist.json — what
 * sanitizeEmailHTML made of each of those inputs — and runs the list that
 * file records from sanitize.go. What it reads is Go's HTML tokenizer
 * (golang.org/x/net/html) as far as bodies go: tags, attributes, comments,
 * raw-text elements, and the character references in ENTITIES; a named
 * reference outside those stays as written, where Go knows a longer table.
 * The body renderer writes none.
 */
import { goUrlString, parseGoUrl } from "./go-url";

/** sanitize.go's policy: the elements, the attributes, the schemes a link may use. */
export const SERVER_ALLOWLIST = {
  elements: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "blockquote"],
  attributes: { a: ["href"] },
  urlSchemes: ["http", "https", "mailto"],
} as const satisfies {
  elements: readonly string[];
  attributes: Readonly<Record<string, readonly string[]>>;
  urlSchemes: readonly string[];
};

/** bluemonday's own sets the policy relies on (policy.go). */
const SKIP_CONTENT = new Set(["frame", "frameset", "iframe", "noembed", "noframes", "noscript", "nostyle", "object", "script", "style", "title"]);
const UNSAFE = new Set(["script", "style"]);

/** Go's tokenizer: elements whose content is text up to their end tag, and of those, the ones it does not unescape. */
const RAW_TEXT = new Set(["iframe", "noembed", "noframes", "noscript", "plaintext", "script", "style", "textarea", "title", "xmp"]);
const RCDATA = new Set(["textarea", "title"]);

/** Named references with their semicolon, as Go's table keys them; the ones HTML also takes without it are in LEGACY. */
const ENTITIES: ReadonlyMap<string, string> = new Map([
  ["amp", "&"],
  ["AMP", "&"],
  ["lt", "<"],
  ["LT", "<"],
  ["gt", ">"],
  ["GT", ">"],
  ["quot", '"'],
  ["QUOT", '"'],
  ["apos", "'"],
  ["nbsp", "\u00a0"],
  ["copy", "©"],
  ["COPY", "©"],
  ["reg", "®"],
  ["REG", "®"],
  ["trade", "™"],
  ["hellip", "…"],
  ["mdash", "—"],
  ["ndash", "–"],
  ["lsquo", "‘"],
  ["rsquo", "’"],
  ["ldquo", "“"],
  ["rdquo", "”"],
  ["laquo", "«"],
  ["raquo", "»"],
  ["middot", "·"],
  ["bull", "•"],
  ["euro", "€"],
  ["deg", "°"],
  ["times", "×"],
]);

const LEGACY = new Set(["amp", "AMP", "lt", "LT", "gt", "GT", "quot", "QUOT", "nbsp", "copy", "COPY", "reg", "REG", "laquo", "raquo", "middot", "deg", "times"]);

/** Go's entity lookup: a name keyed with its semicolon, or one of the legacy names without it. */
const entity = (name: string): string | undefined =>
  name.endsWith(";") ? ENTITIES.get(name.slice(0, -1)) : LEGACY.has(name) ? ENTITIES.get(name) : undefined;

/** The longest legacy name Go tries as a prefix (longestEntityWithoutSemicolon). */
const LONGEST_LEGACY = 6;

/** Go's replacements for the C1 range of a numeric reference (html/entity.go). */
const C1: readonly number[] = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019,
  0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];

function numericReference(digits: string, hex: boolean): string {
  let code = parseInt(digits, hex ? 16 : 10);
  if (code >= 0x80 && code <= 0x9f) code = C1[code - 0x80];
  else if (code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) code = 0xfffd;
  return String.fromCodePoint(code);
}

/** One character reference at `at` (an `&`), as Go's unescapeEntity reads it: what it stands for, and how much of `text` it takes. */
function reference(text: string, at: number, attribute: boolean): { value: string; length: number } {
  const literal = { value: "&", length: 1 };
  let i = at + 1;
  if (text[i] === "#") {
    i += 1;
    const hex = text[i] === "x" || text[i] === "X";
    if (hex) i += 1;
    const digits = (hex ? /^[0-9a-fA-F]+/ : /^[0-9]+/).exec(text.slice(i))?.[0] ?? "";
    if (digits === "") return literal;
    i += digits.length;
    if (text[i] === ";") i += 1;
    return { value: numericReference(digits, hex), length: i - at };
  }
  const name = /^[A-Za-z0-9]*;?/.exec(text.slice(i))![0];
  if (name === "" || (attribute && !name.endsWith(";") && text[i + name.length] === "=")) return literal;
  const whole = entity(name);
  if (whole !== undefined) return { value: whole, length: name.length + 1 };
  if (!attribute) {
    for (let j = Math.min(name.length - 1, LONGEST_LEGACY); j > 1; j -= 1) {
      const prefix = entity(name.slice(0, j));
      if (prefix !== undefined) return { value: prefix, length: j + 1 };
    }
  }
  return literal;
}

/** Character references as Go reads them, in text or in an attribute's value. */
function unescapeReferences(text: string, attribute: boolean): string {
  let out = "";
  let at = 0;
  for (let amp = text.indexOf("&"); amp >= 0; amp = text.indexOf("&", at)) {
    const { value, length } = reference(text, amp, attribute);
    out += text.slice(at, amp) + value;
    at = amp + length;
  }
  return out + text.slice(at);
}

const convertNewlines = (text: string) => text.replace(/\r\n?/g, "\n");

/** Go's html escaping, as bluemonday writes text and attribute values back. */
export function escapeLikeGo(text: string): string {
  return text.replace(/[&'<>"\r]/g, (c) => ({ "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;", '"': "&#34;", "\r": "&#13;" })[c]!);
}

type Attribute = { key: string; value: string };

type Token =
  | { type: "text"; data: string }
  | { type: "start" | "selfClosing"; name: string; attributes: Attribute[] }
  | { type: "end"; name: string }
  | { type: "comment" };

const SPACE = /[\t\n\f\r ]/;

/** The tokens of `html` as golang.org/x/net/html's Tokenizer hands them to bluemonday. */
function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  let rawEnd: string | null = null;

  const text = (data: string, raw = false) => {
    if (data === "") return;
    const lines = convertNewlines(data);
    tokens.push({ type: "text", data: raw ? lines.replaceAll("\0", "\ufffd") : unescapeReferences(lines, false) });
  };

  /**
   * Reads a tag's attributes from `at`, up to and past its `>`: whether it
   * closed itself, or "eof" when the input ends inside the tag — Go's
   * tokenizer then stops with an error, and bluemonday with it.
   */
  const attributes = (into: Attribute[]): boolean | "eof" => {
    for (;;) {
      while (at < html.length && (SPACE.test(html[at]) || (html[at] === "/" && html[at + 1] !== ">"))) at += 1;
      if (at >= html.length) return "eof";
      if (html[at] === ">") {
        at += 1;
        return false;
      }
      if (html.startsWith("/>", at)) {
        at += 2;
        return true;
      }
      let key = html[at];
      at += 1;
      while (at < html.length && !SPACE.test(html[at]) && !"/>=".includes(html[at])) key += html[at++];
      while (at < html.length && SPACE.test(html[at])) at += 1;
      let value = "";
      if (html[at] === "=") {
        at += 1;
        while (at < html.length && SPACE.test(html[at])) at += 1;
        const quote = html[at];
        if (quote === '"' || quote === "'") {
          const close = html.indexOf(quote, at + 1);
          if (close < 0) return "eof";
          value = html.slice(at + 1, close);
          at = close + 1;
        } else {
          while (at < html.length && !SPACE.test(html[at]) && html[at] !== ">") value += html[at++];
        }
      }
      const name = key.replaceAll("\0", "\ufffd").toLowerCase();
      // The first of two attributes with one name is the one kept.
      if (!into.some((attribute) => attribute.key === name)) {
        into.push({ key: name, value: unescapeReferences(convertNewlines(value.replaceAll("\0", "\ufffd")), true) });
      }
    }
  };

  /** Where a comment that starts at `from` (after `<!--`) ends, as Go's readComment finds it. */
  const commentEnd = (from: number): number => {
    let dashes = 0;
    let beginning = true;
    for (let i = from; i < html.length; i += 1) {
      const c = html[i];
      if (c === "-") {
        dashes += 1;
        continue;
      }
      if (c === ">" && (dashes >= 2 || beginning)) return i + 1;
      if (c === "!" && dashes >= 2 && html[i + 1] === ">") return i + 2;
      dashes = 0;
      beginning = false;
    }
    return html.length;
  };

  while (at < html.length) {
    if (rawEnd !== null) {
      const closing = new RegExp(`</${rawEnd}(?=[\\t\\n\\f\\r />])`, "i");
      const found = closing.exec(html.slice(at));
      const end = found ? at + found.index : html.length;
      text(html.slice(at, end), !RCDATA.has(rawEnd));
      at = end;
      rawEnd = null;
      continue;
    }
    const open = html.indexOf("<", at);
    if (open < 0) {
      text(html.slice(at));
      break;
    }
    const next = html[open + 1] ?? "";
    const letter = /[A-Za-z]/;
    if (letter.test(next) || (next === "/" && letter.test(html[open + 2] ?? ""))) {
      text(html.slice(at, open));
      const closingTag = next === "/";
      at = open + (closingTag ? 2 : 1);
      let name = "";
      while (at < html.length && !SPACE.test(html[at]) && html[at] !== "/" && html[at] !== ">") name += html[at++];
      name = name.toLowerCase();
      const read: Attribute[] = [];
      const selfClosing = attributes(read);
      if (selfClosing === "eof") break;
      if (closingTag) {
        tokens.push({ type: "end", name });
      } else {
        tokens.push({ type: selfClosing ? "selfClosing" : "start", name, attributes: read });
        // Go reads what follows as text even when the tag closed itself (`<style/>`).
        if (RAW_TEXT.has(name)) rawEnd = name;
      }
      continue;
    }
    if ((next === "!" || next === "?" || next === "/") && open + 2 < html.length) {
      text(html.slice(at, open));
      if (html.startsWith("<!--", open)) {
        at = commentEnd(open + 4);
      } else if (html.startsWith("</>", open)) {
        // `</>` is nothing at all.
        at = open + 3;
      } else {
        const close = html.indexOf(">", open + 2);
        at = close < 0 ? html.length : close + 1;
      }
      tokens.push({ type: "comment" });
      continue;
    }
    // A `<` that opens nothing is text.
    text(html.slice(at, open + 1));
    at = open + 1;
  }
  return mergeText(tokens);
}

/** Adjacent text is one token, as Go's tokenizer reads it. */
function mergeText(tokens: Token[]): Token[] {
  const merged: Token[] = [];
  for (const token of tokens) {
    const last = merged.at(-1);
    if (token.type === "text" && last?.type === "text") last.data += token.data;
    else merged.push(token);
  }
  return merged;
}

const serialise = (name: string, attributes: readonly Attribute[], end: ">" | "/>") =>
  `<${name}${attributes.map(({ key, value }) => ` ${key}="${escapeLikeGo(value)}"`).join("")}${end}`;

/**
 * bluemonday's validURL under this policy: the address as Go writes it back,
 * or null when the server drops the link.
 */
export function serverHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (/[ \t\n]/.test(trimmed)) return null;
  const url = parseGoUrl(trimmed);
  if (url === null || !(SERVER_ALLOWLIST.urlSchemes as readonly string[]).includes(url.scheme)) return null;
  return goUrlString(url);
}

const ELEMENTS: ReadonlySet<string> = new Set(SERVER_ALLOWLIST.elements);
const ATTRIBUTES: ReadonlyMap<string, readonly string[]> = new Map(Object.entries(SERVER_ALLOWLIST.attributes));

/** Kept attributes, links checked, and what the server adds to a link to another site. */
function allowedAttributes(name: string, attributes: readonly Attribute[], serverAdditions: boolean): Attribute[] {
  const allowed = ATTRIBUTES.get(name) ?? [];
  const kept: Attribute[] = [];
  for (const attribute of attributes) {
    if (!allowed.includes(attribute.key)) continue;
    if (name === "a" && attribute.key === "href") {
      const href = serverHref(attribute.value);
      if (href !== null) kept.push({ key: "href", value: href });
      continue;
    }
    kept.push(attribute);
  }
  const href = kept.find((attribute) => attribute.key === "href");
  const external = href !== undefined && (parseGoUrl(href.value)?.host.length ?? 0) > 0;
  if (serverAdditions && name === "a" && external) kept.push({ key: "target", value: "_blank" }, { key: "rel", value: "noopener" });
  return kept;
}

/**
 * What the server makes of `html`: bluemonday's walk over the tokens with
 * sanitize.go's policy. With `serverAdditions: false` the target and rel it
 * adds to a link to another site are left out, which is what "kept as it is"
 * is measured against.
 */
export function sanitizeLikeServer(html: string, { serverAdditions = true }: { serverAdditions?: boolean } = {}): string {
  // bluemonday hands back input that is only whitespace untouched.
  if (html.trim() === "") return html;
  let out = "";
  // bluemonday's own bookkeeping, kept as it keeps it: a stray end tag can take the count below zero.
  let skipContent = false;
  let skipping = 0;
  let mostRecentlyStarted = "";
  const closingToSkip: string[] = [];
  const known = (name: string) => ELEMENTS.has(name) || ATTRIBUTES.has(name);

  for (const token of tokenize(html)) {
    switch (token.type) {
      case "comment":
        break;
      case "start":
      case "selfClosing": {
        if (token.type === "start") mostRecentlyStarted = token.name;
        if (UNSAFE.has(token.name)) break;
        if (!known(token.name)) {
          if (token.type === "start" && SKIP_CONTENT.has(token.name)) {
            skipContent = true;
            skipping += 1;
          }
          break;
        }
        const attributes = allowedAttributes(token.name, token.attributes, serverAdditions);
        // An element that needs an attribute and has none left goes, and so does its end tag.
        if (attributes.length === 0 && !ELEMENTS.has(token.name)) {
          if (token.type === "start") closingToSkip.push(token.name);
          break;
        }
        if (!skipContent) out += serialise(token.name, attributes, token.type === "start" ? ">" : "/>");
        break;
      }
      case "end": {
        if (mostRecentlyStarted === token.name) mostRecentlyStarted = "";
        if (UNSAFE.has(token.name)) break;
        if (closingToSkip.length > 0 && closingToSkip.at(-1) === token.name) {
          closingToSkip.pop();
          break;
        }
        if (!known(token.name)) {
          if (SKIP_CONTENT.has(token.name)) {
            skipping -= 1;
            if (skipping === 0) skipContent = false;
          }
          break;
        }
        if (!skipContent) out += `</${token.name}>`;
        break;
      }
      case "text":
        if (!skipContent && !UNSAFE.has(mostRecentlyStarted)) out += escapeLikeGo(token.data);
        break;
    }
  }
  return out;
}
