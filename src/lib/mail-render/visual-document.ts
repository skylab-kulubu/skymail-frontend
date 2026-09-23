/**
 * The Visual Authoring mode's source: the document the Visual editor writes,
 * as versioned JSON. The render module turns it into mail with the club's
 * own components (visual.tsx); the API stores it as jsonb, beside the other
 * sources of a Mail template version.
 *
 * What a document may hold is closed, and it is read strictly: a block, mark,
 * inline node or field this model does not name is a problem to report, never
 * something to drop on the way to a render. Nothing in it chooses a colour, a
 * style or markup — only which house component a block becomes — so the
 * mail it renders carries the house look, dark theme included, by
 * construction. Variables and conditions are named here and become Go
 * template actions only when rendered.
 *
 * The API gives jsonb back with its keys in an order of its own, so a
 * document is read into objects with one fixed key order and marks in one
 * fixed order: the same document always serialises to the same text, which is
 * what the save rule compares.
 *
 * This file is light on purpose (no React, no renderer): the editor reads and
 * checks documents with it in the page.
 */

import { isVariableName } from "./go-template";

export const VISUAL_DOCUMENT_TYPE = "skymail.visual";
export const VISUAL_DOCUMENT_VERSION = 1;

export type VisualMark = { type: "bold" } | { type: "italic" } | { type: "link"; href: string };

export type VisualInline =
  | { type: "text"; text: string; marks?: VisualMark[] }
  /** `{{.name}}` when rendered. */
  | { type: "variable"; name: string; marks?: VisualMark[] };

/** Where a button goes: an address, or the value of a variable, when the send has one. */
export type ButtonLink = { url: string } | { variable: string };

export type VisualBlock =
  /** The house Heading: plain text and variables, no marks. */
  | { type: "heading"; content: VisualInline[] }
  | { type: "paragraph"; content: VisualInline[] }
  | { type: "button"; label: string; link: ButtonLink }
  /** An image over https (imageAddressProblem); a width in pixels, or the width of the mail. */
  | { type: "image"; src: string; alt: string; width?: number }
  | { type: "divider" }
  /** Its blocks show only when the variable is set (`{{if .X}}`), or only when it is not (`{{if not .X}}`). */
  | { type: "conditional"; variable: string; when: "set" | "unset"; blocks: VisualBlock[] };

export type VisualDocument = {
  type: typeof VISUAL_DOCUMENT_TYPE;
  version: typeof VISUAL_DOCUMENT_VERSION;
  blocks: VisualBlock[];
};

export type VisualRead = { ok: true; document: VisualDocument } | { ok: false; problems: string[] };

export type VisualBlockType = VisualBlock["type"];

export type VisualMarkType = VisualMark["type"];

/**
 * What a document may use. A Mail template's body may use all of it; a body
 * that goes through another gate — ticket 16's free announcement, which the
 * server's allow-list sanitizes — only what survives it. The reader refuses
 * what an allowance leaves out, and the editor offers only what it allows.
 * `variables` covers inline variables and a button linking to one; a
 * conditional section needs them too.
 */
export type VisualAllowance = Readonly<{
  blocks: readonly VisualBlockType[];
  marks: readonly VisualMarkType[];
  variables: boolean;
}>;

export const EVERY_VISUAL_FEATURE: VisualAllowance = {
  blocks: ["heading", "paragraph", "button", "image", "divider", "conditional"],
  marks: ["bold", "italic", "link"],
  variables: true,
};

export { isVariableName };

export const IMAGE_WIDTH = { min: 16, max: 600 } as const;

/** Why a width cannot be an image's, or null when it can: none (the mail's width) or whole pixels within IMAGE_WIDTH. */
export function imageWidthProblem(width: unknown): string | null {
  const ok =
    width === undefined ||
    (typeof width === "number" && Number.isInteger(width) && width >= IMAGE_WIDTH.min && width <= IMAGE_WIDTH.max);
  return ok ? null : `genişlik ${IMAGE_WIDTH.min} ile ${IMAGE_WIDTH.max} piksel arasında bir tam sayı olmalı`;
}

/** The one order marks are kept in, however they were applied. */
export const MARK_ORDER: readonly VisualMarkType[] = ["bold", "italic", "link"];

export const sortMarks = (marks: readonly VisualMark[]): VisualMark[] =>
  [...marks].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));

const withMarks = (marks: readonly VisualMark[] | undefined) => (marks && marks.length > 0 ? { marks: sortMarks(marks) } : {});

/**
 * The model's nodes, each with its keys in the one order a document is
 * written in: the reader builds with these, and so does the editor, so the
 * same document is always the same text.
 */
export const buildVisual = {
  document: (blocks: VisualBlock[]): VisualDocument => ({ type: VISUAL_DOCUMENT_TYPE, version: VISUAL_DOCUMENT_VERSION, blocks }),
  text: (text: string, marks?: readonly VisualMark[]): VisualInline => ({ type: "text", text, ...withMarks(marks) }),
  variable: (name: string, marks?: readonly VisualMark[]): VisualInline => ({ type: "variable", name, ...withMarks(marks) }),
  heading: (content: VisualInline[]): VisualBlock => ({ type: "heading", content }),
  paragraph: (content: VisualInline[]): VisualBlock => ({ type: "paragraph", content }),
  button: (label: string, link: ButtonLink): VisualBlock => ({
    type: "button",
    label,
    link: "variable" in link ? { variable: link.variable } : { url: link.url },
  }),
  image: (src: string, alt: string, width?: number): VisualBlock => ({
    type: "image",
    src,
    alt,
    ...(width === undefined ? {} : { width }),
  }),
  divider: (): VisualBlock => ({ type: "divider" }),
  conditional: (variable: string, when: "set" | "unset", blocks: VisualBlock[]): VisualBlock => ({
    type: "conditional",
    variable,
    when,
    blocks,
  }),
};

const LINK_PROTOCOLS = ["https:", "http:", "mailto:"];

const hasGoAction = (text: string) => text.includes("{{") || text.includes("}}");

/** Why an address cannot be a link or a button's, or null when it can. */
export function linkAddressProblem(href: string): string | null {
  if (hasGoAction(href)) return "adres Go aksiyonu ({{ … }}) içeremez; değişkene giden bir buton için bağlantıyı değişken seç";
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return `"${href}" bir adres değil`;
  }
  return LINK_PROTOCOLS.includes(url.protocol) ? null : "adres https://, http:// ya da mailto: ile başlamalı";
}

/** The club's own image host: its addresses name no extension, and it serves the mails' own logo. */
export const CLUB_IMAGE_HOST = "cdn.yildizskylab.com";

/** Formats a mail cannot count on being shown, and why. */
const UNSHOWN_FORMATS: readonly { extensions: readonly string[]; why: string }[] = [
  { extensions: [".svg", ".svgz"], why: "SVG kabul edilmez: Gmail ve Outlook SVG göstermez. PNG ya da JPG kullan" },
  { extensions: [".webp"], why: "WebP kabul edilmez: Outlook ve Gmail'in bazı uygulamaları WebP göstermez. PNG ya da JPG kullan" },
];

const SHOWN_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif"];

/**
 * Why an address cannot be an image's, or null when it can. A mail's images
 * come over https, never inside the mail (`data:`). SVG and WebP are refused
 * by name: Gmail and Outlook do not show them. The club's CDN is taken as it
 * is, since its addresses name no extension; any other address has to say
 * it is a PNG, JPG or GIF. What an address really serves is only known by
 * fetching it — that check belongs to the server.
 */
export function imageAddressProblem(src: string): string | null {
  if (hasGoAction(src)) return "görsel adresi Go aksiyonu ({{ … }}) içeremez";
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return `"${src}" bir adres değil`;
  }
  if (url.protocol === "data:") return "görsel maile data: adresiyle gömülemez; https:// ile başlayan bir adres ver";
  if (url.protocol !== "https:") return "görsel adresi https:// ile başlamalı";
  const path = url.pathname.toLowerCase();
  const unshown = UNSHOWN_FORMATS.find(({ extensions }) => extensions.some((extension) => path.endsWith(extension)));
  if (unshown) return unshown.why;
  if (url.hostname === CLUB_IMAGE_HOST) return null;
  if (!SHOWN_EXTENSIONS.some((extension) => path.endsWith(extension))) {
    return `görsel ${CLUB_IMAGE_HOST} üzerinde değilse adresi .png, .jpg, .jpeg ya da .gif ile bitmeli`;
  }
  return null;
}

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads one kind of value, collecting what is wrong with it under its path. */
class Reader {
  readonly problems: string[] = [];

  constructor(private readonly allowance: VisualAllowance) {}

  problem(path: string, message: string) {
    this.problems.push(`${path}: ${message}`);
  }

  /** Every field outside `allowed` is a problem: the model has no field it would ignore. */
  only(fields: Fields, allowed: readonly string[], path: string) {
    for (const key of Object.keys(fields)) {
      if (!allowed.includes(key)) this.problem(path, `bilinmeyen alan "${key}"`);
    }
  }

  variableName(value: unknown, path: string): string | null {
    if (typeof value === "string" && isVariableName(value)) return value;
    this.problem(
      path,
      `${JSON.stringify(value)} bir değişken adı değil: harfle ya da _ ile başlar, yalnız harf, rakam ve _ içerir, en çok 64 karakterdir`,
    );
    return null;
  }

  mark(item: unknown, at: string): VisualMark | null {
    if (!isFields(item)) {
      this.problem(at, "bir biçim değil");
      return null;
    }
    if (item.type !== "bold" && item.type !== "italic" && item.type !== "link") {
      this.problem(at, `bilinmeyen biçim ${JSON.stringify(item.type)}`);
      return null;
    }
    if (!this.allowance.marks.includes(item.type)) {
      this.problem(at, `"${item.type}" biçimi burada kullanılamaz`);
      return null;
    }
    if (item.type !== "link") {
      this.only(item, ["type"], at);
      return { type: item.type };
    }
    this.only(item, ["type", "href"], at);
    const problem = typeof item.href === "string" ? linkAddressProblem(item.href) : "bağlantının adresi yok";
    if (problem) {
      this.problem(`${at}.href`, problem);
      return null;
    }
    return { type: "link", href: item.href as string };
  }

  marks(value: unknown, path: string): VisualMark[] | null {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      this.problem(path, "biçimler bir liste olmalı");
      return null;
    }
    const read = value.map((item, index) => this.mark(item, `${path}[${index}]`));
    const marks = read.filter((mark): mark is VisualMark => mark !== null);
    let ok = marks.length === read.length;
    for (const type of MARK_ORDER) {
      if (marks.filter((mark) => mark.type === type).length > 1) {
        this.problem(path, `"${type}" iki kez`);
        ok = false;
      }
    }
    return ok ? marks : null;
  }

  inlines(value: unknown, path: string, { marksAllowed }: { marksAllowed: boolean }): VisualInline[] {
    if (!Array.isArray(value)) {
      this.problem(path, "içerik bir liste olmalı");
      return [];
    }
    const inlines: VisualInline[] = [];
    value.forEach((item, index) => {
      const at = `${path}[${index}]`;
      if (!isFields(item)) {
        this.problem(at, "bir metin ya da değişken değil");
        return;
      }
      if (item.type !== "text" && item.type !== "variable") {
        this.problem(at, `bilinmeyen satır içi öğe ${JSON.stringify(item.type)}`);
        return;
      }
      this.only(item, item.type === "text" ? ["type", "text", "marks"] : ["type", "name", "marks"], at);
      const marks = this.marks(item.marks, `${at}.marks`) ?? [];
      if (marks.length > 0 && !marksAllowed) {
        this.problem(at, "başlıkta biçim (kalın, italik, bağlantı) kullanılmaz");
      }
      if (item.type === "text") {
        if (typeof item.text !== "string" || item.text === "") {
          this.problem(`${at}.text`, "boş metin olmaz");
          return;
        }
        inlines.push(buildVisual.text(item.text, marks));
        return;
      }
      if (!this.allowance.variables) {
        this.problem(at, "değişken burada kullanılamaz");
        return;
      }
      const name = this.variableName(item.name, `${at}.name`);
      if (name) inlines.push(buildVisual.variable(name, marks));
    });
    return inlines;
  }

  link(value: unknown, path: string): ButtonLink | null {
    if (!isFields(value) || Object.keys(value).length !== 1 || !("url" in value || "variable" in value)) {
      this.problem(path, 'bağlantı ya bir adres ("url") ya da bir değişken ("variable") olmalı, ikisi birden değil');
      return null;
    }
    if ("variable" in value) {
      if (!this.allowance.variables) {
        this.problem(path, "bağlantı burada bir değişken olamaz");
        return null;
      }
      const name = this.variableName(value.variable, `${path}.variable`);
      return name ? { variable: name } : null;
    }
    const problem = typeof value.url === "string" ? linkAddressProblem(value.url) : "adres yok";
    if (problem) {
      this.problem(`${path}.url`, problem);
      return null;
    }
    return { url: value.url as string };
  }

  image(item: Fields, path: string): VisualBlock | null {
    this.only(item, ["type", "src", "alt", "width"], path);
    const srcProblem = typeof item.src === "string" ? imageAddressProblem(item.src) : "görselin adresi yok";
    if (srcProblem) this.problem(`${path}.src`, srcProblem);
    if (typeof item.alt !== "string") this.problem(`${path}.alt`, "görselin açıklaması (alt) bir metin olmalı");
    const widthProblem = imageWidthProblem(item.width);
    if (widthProblem) this.problem(`${path}.width`, widthProblem);
    if (srcProblem || typeof item.alt !== "string" || widthProblem) return null;
    return buildVisual.image(item.src as string, item.alt, item.width as number | undefined);
  }

  block(item: unknown, path: string): VisualBlock | null {
    if (!isFields(item)) {
      this.problem(path, "bir blok değil");
      return null;
    }
    const type = item.type as VisualBlockType;
    if (!EVERY_VISUAL_FEATURE.blocks.includes(type)) {
      this.problem(path, `bilinmeyen blok ${JSON.stringify(item.type)}`);
      return null;
    }
    if (!this.allowance.blocks.includes(type) || (type === "conditional" && !this.allowance.variables)) {
      this.problem(path, `"${type}" bloğu burada kullanılamaz`);
      return null;
    }
    switch (type) {
      case "heading":
      case "paragraph": {
        this.only(item, ["type", "content"], path);
        const content = this.inlines(item.content, `${path}.content`, { marksAllowed: type === "paragraph" });
        return type === "heading" ? buildVisual.heading(content) : buildVisual.paragraph(content);
      }
      case "button": {
        this.only(item, ["type", "label", "link"], path);
        const labelOk = typeof item.label === "string" && item.label.trim() !== "";
        if (!labelOk) this.problem(`${path}.label`, "butonun etiketi boş olamaz");
        const link = this.link(item.link, `${path}.link`);
        return labelOk && link ? buildVisual.button(item.label as string, link) : null;
      }
      case "image":
        return this.image(item, path);
      case "divider":
        this.only(item, ["type"], path);
        return buildVisual.divider();
      case "conditional": {
        this.only(item, ["type", "variable", "when", "blocks"], path);
        const variable = this.variableName(item.variable, `${path}.variable`);
        const whenOk = item.when === "set" || item.when === "unset";
        if (!whenOk) this.problem(`${path}.when`, '"set" (değişken doluysa) ya da "unset" (değişken boşsa) olmalı');
        const blocks = this.blocks(item.blocks, `${path}.blocks`);
        return variable && whenOk ? buildVisual.conditional(variable, item.when as "set" | "unset", blocks) : null;
      }
      default: {
        const unknown: never = type;
        throw new Error(`Visual belge okuyucusu "${String(unknown)}" bloğunu tanımıyor.`);
      }
    }
  }

  blocks(value: unknown, path: string): VisualBlock[] {
    if (!Array.isArray(value)) {
      this.problem(path, "bloklar bir liste olmalı");
      return [];
    }
    return value.flatMap((item, index) => this.block(item, `${path}[${index}]`) ?? []);
  }
}

/**
 * A document as the API or the editor hands it over, read into the model:
 * every problem it has, or the document with its keys and marks in their one
 * order. `allowance` narrows what it may use; a Mail template's body may use
 * everything.
 */
export function readVisualDocument(value: unknown, allowance: VisualAllowance = EVERY_VISUAL_FEATURE): VisualRead {
  const reader = new Reader(allowance);
  if (!isFields(value)) {
    reader.problem("belge", "bir Visual belge değil (bir JSON nesnesi bekleniyordu)");
    return { ok: false, problems: reader.problems };
  }
  if (value.type !== VISUAL_DOCUMENT_TYPE) {
    reader.problem("belge", `türü "${VISUAL_DOCUMENT_TYPE}" değil: ${JSON.stringify(value.type)}`);
    return { ok: false, problems: reader.problems };
  }
  if (value.version !== VISUAL_DOCUMENT_VERSION) {
    reader.problem("belge", `sürüm ${JSON.stringify(value.version)}; bu panel yalnız ${VISUAL_DOCUMENT_VERSION}. sürümü okur`);
    return { ok: false, problems: reader.problems };
  }
  reader.only(value, ["type", "version", "blocks"], "belge");
  const blocks = reader.blocks(value.blocks, "blocks");
  if (reader.problems.length > 0) return { ok: false, problems: reader.problems };
  return { ok: true, document: buildVisual.document(blocks) };
}

/** A Visual source, which is the document's JSON text. */
export function parseVisualSource(source: string, allowance: VisualAllowance = EVERY_VISUAL_FEATURE): VisualRead {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return { ok: false, problems: [`belge: JSON değil (${error instanceof Error ? error.message : String(error)})`] };
  }
  return readVisualDocument(value, allowance);
}

/**
 * The source text of a document: its JSON, keys and marks in their one order,
 * so the same document is always the same text. A document the model would
 * refuse is never written; that is a caller's mistake.
 */
export function visualSource(document: VisualDocument): string {
  const read = readVisualDocument(document);
  if (!read.ok) throw new Error(`Geçersiz Visual belge: ${read.problems.join("; ")}`);
  return JSON.stringify(read.document);
}

/** Where a new Visual source starts: nothing. No other source is converted into it. */
export const EMPTY_VISUAL_SOURCE = visualSource(buildVisual.document([]));

/** The variables a document uses — inline, as a button's link, as a condition — each once, sorted. */
export function visualDocumentVariables(document: VisualDocument): string[] {
  const found = new Set<string>();
  const walk = (blocks: readonly VisualBlock[]) => {
    for (const block of blocks) {
      switch (block.type) {
        case "heading":
        case "paragraph":
          for (const inline of block.content) if (inline.type === "variable") found.add(inline.name);
          break;
        case "button":
          if ("variable" in block.link) found.add(block.link.variable);
          break;
        case "conditional":
          found.add(block.variable);
          walk(block.blocks);
          break;
      }
    }
  };
  walk(document.blocks);
  return [...found].sort();
}
