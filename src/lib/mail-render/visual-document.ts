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
  /** A PNG or JPG over https; a width in pixels, or the width of the mail. */
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

/** skymail-backend's variable name rule (pkg/validator IsVariableName). */
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export const isVariableName = (name: string) => VARIABLE_NAME.test(name);

export const IMAGE_WIDTH = { min: 16, max: 600 } as const;

const MARK_ORDER: readonly VisualMark["type"][] = ["bold", "italic", "link"];

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

/**
 * Why an address cannot be an image's, or null when it can. Gmail and Outlook
 * do not show SVG at all, and a mail's images come over https, so a PNG or
 * JPG over https is all a Visual image may be; the address has to say which
 * it is, since nothing else here can tell.
 */
export function imageAddressProblem(src: string): string | null {
  if (hasGoAction(src)) return "görsel adresi Go aksiyonu ({{ … }}) içeremez";
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return `"${src}" bir adres değil`;
  }
  if (url.protocol !== "https:") return "görsel adresi https:// ile başlamalı";
  const path = url.pathname.toLowerCase();
  if (path.endsWith(".svg") || path.endsWith(".svgz")) {
    return "SVG kabul edilmez: Gmail ve Outlook SVG göstermez. PNG ya da JPG kullan";
  }
  if (![".png", ".jpg", ".jpeg"].some((extension) => path.endsWith(extension))) {
    return "görsel PNG ya da JPG olmalı: adresi .png, .jpg ya da .jpeg ile bitmeli";
  }
  return null;
}

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads one kind of value, collecting what is wrong with it under its path. */
class Reader {
  readonly problems: string[] = [];

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

  marks(value: unknown, path: string): VisualMark[] | null {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      this.problem(path, "biçimler bir liste olmalı");
      return null;
    }
    const marks: VisualMark[] = [];
    let ok = true;
    value.forEach((item, index) => {
      const at = `${path}[${index}]`;
      if (!isFields(item)) {
        this.problem(at, "bir biçim değil");
        ok = false;
        return;
      }
      switch (item.type) {
        case "bold":
        case "italic":
          this.only(item, ["type"], at);
          marks.push({ type: item.type });
          return;
        case "link": {
          this.only(item, ["type", "href"], at);
          const problem = typeof item.href === "string" ? linkAddressProblem(item.href) : "bağlantının adresi yok";
          if (problem) {
            this.problem(`${at}.href`, problem);
            ok = false;
            return;
          }
          marks.push({ type: "link", href: item.href as string });
          return;
        }
        default:
          this.problem(at, `bilinmeyen biçim ${JSON.stringify(item.type)}`);
          ok = false;
      }
    });
    for (const type of MARK_ORDER) {
      if (marks.filter((mark) => mark.type === type).length > 1) {
        this.problem(path, `"${type}" iki kez`);
        ok = false;
      }
    }
    return ok ? marks.sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type)) : null;
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
      const marks = this.marks(item.marks, `${at}.marks`);
      if (marks && marks.length > 0 && !marksAllowed) {
        this.problem(at, "başlıkta biçim (kalın, italik, bağlantı) kullanılmaz");
      }
      const withMarks = marks && marks.length > 0 ? { marks } : {};
      if (item.type === "text") {
        if (typeof item.text !== "string" || item.text === "") {
          this.problem(`${at}.text`, "boş metin olmaz");
          return;
        }
        inlines.push({ type: "text", text: item.text, ...withMarks });
      } else {
        const name = this.variableName(item.name, `${at}.name`);
        if (name) inlines.push({ type: "variable", name, ...withMarks });
      }
    });
    return inlines;
  }

  link(value: unknown, path: string): ButtonLink | null {
    if (!isFields(value) || Object.keys(value).length !== 1 || !("url" in value || "variable" in value)) {
      this.problem(path, 'bağlantı ya bir adres ("url") ya da bir değişken ("variable") olmalı, ikisi birden değil');
      return null;
    }
    if ("variable" in value) {
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
    const problem = typeof item.src === "string" ? imageAddressProblem(item.src) : "görselin adresi yok";
    if (problem) this.problem(`${path}.src`, problem);
    if (typeof item.alt !== "string") this.problem(`${path}.alt`, "görselin açıklaması (alt) bir metin olmalı");
    const width = item.width;
    const widthOk =
      width === undefined ||
      (typeof width === "number" && Number.isInteger(width) && width >= IMAGE_WIDTH.min && width <= IMAGE_WIDTH.max);
    if (!widthOk) this.problem(`${path}.width`, `genişlik ${IMAGE_WIDTH.min} ile ${IMAGE_WIDTH.max} piksel arasında bir tam sayı olmalı`);
    if (problem || typeof item.alt !== "string" || !widthOk) return null;
    return { type: "image", src: item.src as string, alt: item.alt, ...(width === undefined ? {} : { width: width as number }) };
  }

  block(item: unknown, path: string): VisualBlock | null {
    if (!isFields(item)) {
      this.problem(path, "bir blok değil");
      return null;
    }
    switch (item.type) {
      case "heading":
      case "paragraph": {
        this.only(item, ["type", "content"], path);
        const content = this.inlines(item.content, `${path}.content`, { marksAllowed: item.type === "paragraph" });
        return { type: item.type, content };
      }
      case "button": {
        this.only(item, ["type", "label", "link"], path);
        const labelOk = typeof item.label === "string" && item.label.trim() !== "";
        if (!labelOk) this.problem(`${path}.label`, "butonun etiketi boş olamaz");
        const link = this.link(item.link, `${path}.link`);
        return labelOk && link ? { type: "button", label: item.label as string, link } : null;
      }
      case "image":
        return this.image(item, path);
      case "divider":
        this.only(item, ["type"], path);
        return { type: "divider" };
      case "conditional": {
        this.only(item, ["type", "variable", "when", "blocks"], path);
        const variable = this.variableName(item.variable, `${path}.variable`);
        const whenOk = item.when === "set" || item.when === "unset";
        if (!whenOk) this.problem(`${path}.when`, '"set" (değişken doluysa) ya da "unset" (değişken boşsa) olmalı');
        const blocks = this.blocks(item.blocks, `${path}.blocks`);
        return variable && whenOk ? { type: "conditional", variable, when: item.when as "set" | "unset", blocks } : null;
      }
      default:
        this.problem(path, `bilinmeyen blok ${JSON.stringify(item.type)}`);
        return null;
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
 * order.
 */
export function readVisualDocument(value: unknown): VisualRead {
  const reader = new Reader();
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
  return { ok: true, document: { type: VISUAL_DOCUMENT_TYPE, version: VISUAL_DOCUMENT_VERSION, blocks } };
}

/** A Visual source, which is the document's JSON text. */
export function parseVisualSource(source: string): VisualRead {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return { ok: false, problems: [`belge: JSON değil (${error instanceof Error ? error.message : String(error)})`] };
  }
  return readVisualDocument(value);
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
export const EMPTY_VISUAL_SOURCE = visualSource({ type: VISUAL_DOCUMENT_TYPE, version: VISUAL_DOCUMENT_VERSION, blocks: [] });

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
