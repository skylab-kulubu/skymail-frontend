/**
 * Go's net/url, as far as the server's allow-list uses it: bluemonday keeps a
 * link only when `url.Parse` takes its address, and writes the address back
 * as `URL.String()` gives it (server-allowlist.ts). The two differ from the
 * browser's URL in ways that matter to a mail — Go re-escapes `|`, `^` or
 * `{` in a path, drops an empty `#`, refuses a stray `%` — so a body the
 * panel writes, and a preview of what the server keeps, need Go's rules
 * rather than the browser's.
 *
 * Ported from Go 1.25 `net/url` (the version skymail-backend builds with):
 * getScheme, parse, parseAuthority, parseHost, setPath / EscapedPath,
 * setFragment / EscapedFragment, shouldEscape, validEncoded, escape, unescape
 * and String, with netip's reading of an IPv6 host. Go works on bytes, so
 * this does too.
 */

type Mode = "path" | "fragment" | "host" | "zone" | "userPassword";

type Bytes = readonly number[];

const utf8 = (text: string): number[] => [...new TextEncoder().encode(text)];

const char = (c: string) => c.charCodeAt(0);

const isAlnum = (c: number) => (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39);

const isHex = (c: number) => (c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x66) || (c >= 0x41 && c <= 0x46);

const among = (c: number, set: string) => c < 0x80 && set.includes(String.fromCharCode(c));

function shouldEscape(c: number, mode: Mode): boolean {
  if (isAlnum(c)) return false;
  if ((mode === "host" || mode === "zone") && among(c, "!$&'()*+,;=:[]<>\"")) return false;
  if (among(c, "-_.~")) return false;
  if (among(c, "$&+,/:;=?@")) {
    switch (mode) {
      case "path":
        return c === char("?");
      case "userPassword":
        return among(c, "@/?:");
      case "fragment":
        return false;
      case "host":
      case "zone":
        break;
    }
  }
  if (mode === "fragment" && among(c, "!()*")) return false;
  return true;
}

function validEncoded(s: Bytes, mode: Mode): boolean {
  return s.every((c) => among(c, "!$&'()*+,;=:@[]%") || !shouldEscape(c, mode));
}

const HEX = "0123456789ABCDEF";

/** Go's escape: every byte that should be escaped as %XX. */
function escape(s: Bytes, mode: Mode): string {
  let out = "";
  for (const c of s) out += shouldEscape(c, mode) ? `%${HEX[c >> 4]}${HEX[c & 15]}` : String.fromCharCode(c);
  return out;
}

/** Go's unescape: the bytes, or null where Go returns an error. */
function unescape(s: Bytes, mode: Mode): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === char("%")) {
      if (i + 2 >= s.length || !isHex(s[i + 1]) || !isHex(s[i + 2])) return null;
      const byte = parseInt(String.fromCharCode(s[i + 1], s[i + 2]), 16);
      const isPercent = s[i + 1] === char("2") && s[i + 2] === char("5");
      if (mode === "host" && byte >> 4 < 8 && !isPercent) return null;
      if (mode === "zone" && !isPercent && byte !== char(" ") && shouldEscape(byte, "host")) return null;
      out.push(byte);
      i += 3;
      continue;
    }
    if ((mode === "host" || mode === "zone") && c < 0x80 && shouldEscape(c, mode)) return null;
    out.push(c);
    i += 1;
  }
  return out;
}

const text = (bytes: Bytes) => String.fromCharCode(...bytes);

const equal = (a: Bytes, b: Bytes) => a.length === b.length && a.every((byte, index) => byte === b[index]);

/** Everything `String()` needs of a parsed URL. */
export type GoUrl = {
  scheme: string;
  opaque: string;
  user: { username: Bytes; password: Bytes | null } | null;
  /** Unescaped, as Go keeps it. */
  host: Bytes;
  omitHost: boolean;
  path: Bytes;
  /** The path as written, when that is not how Go would escape `path`. */
  rawPath: Bytes | null;
  forceQuery: boolean;
  rawQuery: string;
  fragment: Bytes;
  rawFragment: Bytes | null;
};

function getScheme(raw: string): { scheme: string; rest: string } | null {
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw.charCodeAt(i);
    if ((c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a)) continue;
    if ((c >= 0x30 && c <= 0x39) || among(c, "+-.")) {
      if (i === 0) return { scheme: "", rest: raw };
      continue;
    }
    if (c === char(":")) return i === 0 ? null : { scheme: raw.slice(0, i), rest: raw.slice(i + 1) };
    return { scheme: "", rest: raw };
  }
  return { scheme: "", rest: raw };
}

const validOptionalPort = (port: string) => port === "" || /^:[0-9]*$/.test(port);

const isIPv4 = (s: string) => /^(0|[1-9][0-9]{0,2})(\.(0|[1-9][0-9]{0,2})){3}$/.test(s) && s.split(".").every((part) => Number(part) <= 255);

/** netip.ParseAddr taking `s` as an IPv6 address — the one kind of address a bracketed host may hold. */
function isIPv6(input: string): boolean {
  // ParseAddr goes by the first '.', ':' or '%': an IPv4 address (refused in brackets) or no address.
  if (/[.:%]/.exec(input)?.[0] !== ":") return false;
  let s = input;
  const percent = s.indexOf("%");
  if (percent !== -1) {
    if (percent === s.length - 1) return false;
    s = s.slice(0, percent);
  }
  let ellipsis = -1;
  let filled = 0;
  if (s.startsWith("::")) {
    ellipsis = 0;
    s = s.slice(2);
    if (s === "") return true;
  }
  while (filled < 16) {
    const digits = /^[0-9a-fA-F]*/.exec(s)![0];
    if (digits.length === 0 || digits.length > 4) return false;
    if (s[digits.length] === ".") {
      if ((ellipsis < 0 && filled !== 12) || filled + 4 > 16 || !isIPv4(s)) return false;
      s = "";
      filled += 4;
      break;
    }
    filled += 2;
    s = s.slice(digits.length);
    if (s === "") break;
    if (s[0] !== ":" || s.length === 1) return false;
    s = s.slice(1);
    if (s[0] === ":") {
      if (ellipsis >= 0) return false;
      ellipsis = filled;
      s = s.slice(1);
      if (s === "") break;
    }
  }
  if (s !== "") return false;
  return filled < 16 ? ellipsis >= 0 : ellipsis < 0;
}

function parseHost(host: string): number[] | null {
  const open = host.lastIndexOf("[");
  if (open !== -1) {
    const close = host.lastIndexOf("]");
    if (close < 0) return null;
    const colonPort = host.slice(close + 1);
    if (!validOptionalPort(colonPort)) return null;
    const hostname = host.slice(open + 1, close);
    const zone = hostname.indexOf("%25");
    const unescaped =
      zone >= 0
        ? [unescape(utf8(hostname.slice(0, zone)), "host"), unescape(utf8(hostname.slice(zone)), "zone")]
        : [unescape(utf8(hostname), "host")];
    if (unescaped.some((part) => part === null)) return null;
    const address = unescaped.flatMap((part) => part!);
    if (!isIPv6(new TextDecoder().decode(new Uint8Array(address)))) return null;
    return [char("["), ...address, char("]"), ...utf8(colonPort)];
  }
  const colon = host.lastIndexOf(":");
  if (colon !== -1 && !validOptionalPort(host.slice(colon))) return null;
  return unescape(utf8(host), "host");
}

const VALID_USERINFO = /^[A-Za-z0-9\-._:~!$&'()*+,;=%@]*$/;

function parseAuthority(authority: string): Pick<GoUrl, "user" | "host"> | null {
  const at = authority.lastIndexOf("@");
  const host = parseHost(at < 0 ? authority : authority.slice(at + 1));
  if (host === null) return null;
  if (at < 0) return { user: null, host };
  const userinfo = authority.slice(0, at);
  if (!VALID_USERINFO.test(userinfo)) return null;
  const colon = userinfo.indexOf(":");
  const username = unescape(utf8(colon < 0 ? userinfo : userinfo.slice(0, colon)), "userPassword");
  const password = colon < 0 ? null : unescape(utf8(userinfo.slice(colon + 1)), "userPassword");
  if (username === null || (colon >= 0 && password === null)) return null;
  return { user: { username, password }, host };
}

const hasControlByte = (s: string) => [...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);

/** Go's `url.Parse`, or null where it returns an error. */
export function parseGoUrl(raw: string): GoUrl | null {
  const hash = raw.indexOf("#");
  const beforeFragment = hash < 0 ? raw : raw.slice(0, hash);
  const rawFragment = hash < 0 ? "" : raw.slice(hash + 1);

  if (hasControlByte(beforeFragment)) return null;
  const split = getScheme(beforeFragment);
  if (split === null) return null;
  const url: GoUrl = {
    scheme: split.scheme.toLowerCase(),
    opaque: "",
    user: null,
    host: [],
    omitHost: false,
    path: [],
    rawPath: null,
    forceQuery: false,
    rawQuery: "",
    fragment: [],
    rawFragment: null,
  };
  let rest = split.rest;
  if (rest.endsWith("?") && rest.split("?").length === 2) {
    url.forceQuery = true;
    rest = rest.slice(0, -1);
  } else {
    const question = rest.indexOf("?");
    if (question >= 0) {
      url.rawQuery = rest.slice(question + 1);
      rest = rest.slice(0, question);
    }
  }

  if (!rest.startsWith("/")) {
    if (url.scheme !== "") {
      url.opaque = rest;
      return withFragment(url, rawFragment);
    }
    if (rest.split("/")[0].includes(":")) return null;
  }

  if ((url.scheme !== "" || !rest.startsWith("///")) && rest.startsWith("//")) {
    let authority = rest.slice(2);
    rest = "";
    const slash = authority.indexOf("/");
    if (slash >= 0) {
      rest = authority.slice(slash);
      authority = authority.slice(0, slash);
    }
    const parsed = parseAuthority(authority);
    if (parsed === null) return null;
    Object.assign(url, parsed);
  } else if (url.scheme !== "" && rest.startsWith("/")) {
    url.omitHost = true;
  }

  const written = utf8(rest);
  const path = unescape(written, "path");
  if (path === null) return null;
  url.path = path;
  url.rawPath = rest === escape(path, "path") ? null : written;
  return withFragment(url, rawFragment);
}

function withFragment(url: GoUrl, raw: string): GoUrl | null {
  if (raw === "") return url;
  const written = utf8(raw);
  const fragment = unescape(written, "fragment");
  if (fragment === null) return null;
  url.fragment = fragment;
  url.rawFragment = raw === escape(fragment, "fragment") ? null : written;
  return url;
}

/** Go's EscapedPath / EscapedFragment: the form as written, when it is a valid one. */
function escaped(value: Bytes, raw: Bytes | null, mode: Mode): string {
  if (raw !== null && validEncoded(raw, mode)) {
    const decoded = unescape(raw, mode);
    if (decoded !== null && equal(decoded, value)) return text(raw);
  }
  return escape(value, mode);
}

/** Go's `URL.String()`. */
export function goUrlString(url: GoUrl): string {
  let out = url.scheme === "" ? "" : `${url.scheme}:`;
  if (url.opaque !== "") {
    out += url.opaque;
  } else {
    const host = url.host.length > 0;
    if (url.scheme !== "" || host || url.user !== null) {
      if (!(url.omitHost && !host && url.user === null)) {
        if (host || url.path.length > 0 || url.user !== null) out += "//";
        if (url.user !== null) {
          out += escape(url.user.username, "userPassword");
          if (url.user.password !== null) out += `:${escape(url.user.password, "userPassword")}`;
          out += "@";
        }
        if (host) out += escape(url.host, "host");
      }
    }
    const path = url.path.length === 1 && url.path[0] === char("*") ? "*" : escaped(url.path, url.rawPath, "path");
    if (path !== "" && !path.startsWith("/") && host) out += "/";
    if (out === "" && path.split("/")[0].includes(":")) out += "./";
    out += path;
  }
  if (url.forceQuery || url.rawQuery !== "") out += `?${url.rawQuery}`;
  if (url.fragment.length > 0) out += `#${escaped(url.fragment, url.rawFragment, "fragment")}`;
  return out;
}
