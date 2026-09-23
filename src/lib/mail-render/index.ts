/**
 * The render module: an Authoring mode source in; the bodies a Mail template
 * stores, and the variables they reference, out. The editor and the Template
 * seed both render through it, so a template in the repo and the same template
 * in the panel's JSX mode produce the same mail.
 *
 * It runs in the browser and in Node alike and knows nothing of Next.js. Babel
 * and the modules a JSX source may import are loaded on the first JSX render,
 * not with the module.
 *
 * Compiling a JSX source runs its code. In the browser that code runs with the
 * rights of whoever is looking at it, so one operator's template could act
 * with another operator's session. The editor must therefore render JSX in an
 * isolated context — an iframe with an opaque origin (`sandbox="allow-scripts"`
 * without `allow-same-origin`) or equivalent — never in the page itself. The
 * module assumes nothing of Next.js or of the page's globals so that it can be
 * hosted there.
 */
import { createElement, type ComponentType } from "react";
import { referencedVariables } from "./go-template";
import { DeadlineError, plainTextFromHtml, renderElement, type ElementOptions } from "./render";
import { parseVisualSource } from "./visual-document";
import { renderWarnings } from "./warnings";

export { blockBalance, referencedVariables } from "./go-template";
export { fillSampleValues, type FillOptions, type SampleValues } from "./preview";
export { decideSave, renderOf, type SaveDecision } from "./save";
export { renderWarnings } from "./warnings";

/** The ways a Mail template's body is written (CONTEXT.md). */
export type AuthoringMode = "jsx" | "visual" | "html";

export interface SourceInput {
  mode: AuthoringMode;
  /** The code or markup as written; for Visual, the document's JSON text (visual-document.ts). */
  source: string;
}

export interface Rendered {
  ok: true;
  /** The body to store, Go template actions intact for the mailer to fill per send. */
  html: string;
  /** The plain-text part, derived from the same body. */
  plainText: string;
  /**
   * The fields of the mailer's data the body references, sorted. The client's
   * view; see referencedVariables in go-template.ts for how far it goes.
   */
  variables: string[];
  /**
   * What the bodies may still get wrong, each worded as what to do; none of it
   * stops a save (warnings.ts).
   */
  warnings: string[];
}

export type RenderFailureReason =
  /** The source is not code Babel compiles, or it imports something not in scope. */
  | "compile"
  /** It compiles, but its default export is not a component. */
  | "no-component"
  /** Running or rendering it threw. */
  | "render"
  /** It rendered, and there is nothing in it. */
  | "empty"
  /** The Visual document is not one the model reads: an unknown block, mark or field, or a value it refuses. */
  | "invalid";

export interface RenderFailure {
  ok: false;
  reason: RenderFailureReason;
  /** Says why, in words an operator can act on. */
  message: string;
}

export type RenderResult = Rendered | RenderFailure;

/** A render remembered with the source it was made from, which is what decideSave compares. */
export type SourceRender = RenderResult & SourceInput;

export interface RenderOptions {
  /**
   * How long a render may take before it counts as failed, in milliseconds.
   * A repo template renders in tens of milliseconds; the default leaves room
   * for a slow browser tab.
   */
  deadlineMs?: number;
}

const DEFAULT_DEADLINE_MS = 10_000;

const failure = (reason: RenderFailureReason, message: string): RenderFailure => ({ ok: false, reason, message });

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Markup with nothing but a doctype, comments and whitespace in it: the blank
 * body the save guard of 2026-09-22 exists for. A component that renders
 * nothing still produces a string that is not empty — a doctype and React's
 * <!--$--> markers — so an empty string is not the test.
 */
const isBlank = (markup: string) =>
  markup
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim() === "";

const EMPTY = failure("empty", "Şablon boş bir gövde üretti; kaydedilecek bir şey yok.");

/**
 * Renders a source. Whatever is wrong with the source comes back as a
 * RenderFailure, and a failure carries no body, so there is nothing to save.
 * It rejects only for a mode it has no renderer for, which is the caller's
 * mistake rather than the operator's.
 */
export async function renderSource(input: SourceInput, options: RenderOptions = {}): Promise<SourceRender> {
  return { ...(await renderByMode(input, options)), mode: input.mode, source: input.source };
}

async function renderByMode({ mode, source }: SourceInput, options: RenderOptions): Promise<RenderResult> {
  switch (mode) {
    case "jsx":
      return renderJsx(source, options);
    case "visual":
      return renderVisual(source, options);
    case "html":
      return renderHtml(source);
    default: {
      // A new Authoring mode fails to compile here until it has its case.
      const unhandled: never = mode;
      throw new Error(`Render modülü "${String(unhandled)}" modunu tanımıyor.`);
    }
  }
}

/**
 * Renders a template component already in hand. This is the Template seed's
 * and emails:render's way in; the panel compiles its component from the source
 * text first and then comes through here too.
 */
export async function renderComponent(Component: ComponentType, options: RenderOptions = {}): Promise<RenderResult> {
  return renderMail(Component, options, {});
}

async function renderMail(Component: ComponentType, options: RenderOptions, element: ElementOptions): Promise<RenderResult> {
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  try {
    const { html, plainText, markup } = await renderElement(createElement(Component), deadlineMs, element);
    if (isBlank(markup)) {
      return EMPTY;
    }
    return { ok: true, html, plainText, variables: referencedVariables(html), warnings: renderWarnings(html, plainText) };
  } catch (error) {
    if (error instanceof DeadlineError) {
      return failure(
        "render",
        `Şablon ${deadlineMs} ms içinde render edilip bitmedi; hiç sonuçlanmayan bir bekleme (ör. çözülmeyen bir Promise) olabilir.`,
      );
    }
    return failure("render", `Şablon render edilirken hata verdi: ${messageOf(error)}`);
  }
}

async function renderJsx(source: string, options: RenderOptions): Promise<RenderResult> {
  let jsx: typeof import("./jsx");
  try {
    jsx = await import("./jsx");
  } catch (error) {
    // In the browser this is a chunk that did not arrive.
    return failure("compile", `JSX derleyicisi yüklenemedi: ${messageOf(error)}`);
  }

  let Component: ComponentType;
  try {
    Component = jsx.compileComponent(source);
  } catch (error) {
    if (error instanceof jsx.CompileError) {
      return failure("compile", `Kod derlenemedi: ${error.message}`);
    }
    if (error instanceof jsx.NoComponentError) {
      return failure("no-component", error.message);
    }
    return failure("render", `Kod çalışırken hata verdi: ${messageOf(error)}`);
  }
  return renderComponent(Component, options);
}

const EMPTY_VISUAL = failure("empty", "Visual belgede gösterilecek bir şey yok; bir başlık, paragraf ya da buton ekle.");

/**
 * A Visual document is read strictly before anything renders: what the model
 * does not know is reported, never dropped. It runs no code of its own.
 */
async function renderVisual(source: string, options: RenderOptions): Promise<RenderResult> {
  const read = parseVisualSource(source);
  if (!read.ok) {
    return failure("invalid", `Visual belge okunamadı: ${read.problems.join("; ")}`);
  }
  let visual: typeof import("./visual");
  try {
    visual = await import("./visual");
  } catch (error) {
    return failure("render", `Visual render yüklenemedi: ${messageOf(error)}`);
  }
  const Mail = visual.visualMail(read.document);
  // Visual has no seed output to match, so its actions stay exactly as it wrote them.
  return Mail ? renderMail(Mail, options, { keepActionsWhole: true }) : EMPTY_VISUAL;
}

/** Raw markup is the body as written; only its plain-text part is derived. */
function renderHtml(source: string): RenderResult {
  if (isBlank(source)) {
    return EMPTY;
  }
  try {
    const plainText = plainTextFromHtml(source);
    return { ok: true, html: source, plainText, variables: referencedVariables(source), warnings: renderWarnings(source, plainText) };
  } catch (error) {
    return failure("render", `Düz metin türetilemedi: ${messageOf(error)}`);
  }
}
