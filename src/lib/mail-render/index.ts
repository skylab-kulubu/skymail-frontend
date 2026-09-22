/**
 * The render module: an Authoring mode source in; the bodies a Mail template
 * stores, and the variables they reference, out. The editor and the Template
 * seed both render through it, so a template in the repo and the same template
 * in the panel's JSX mode produce the same mail.
 *
 * It runs in the browser and in Node alike and knows nothing of Next.js. Babel
 * and the modules a JSX source may import are loaded on the first JSX render,
 * not with the module.
 */
import { createElement, type ComponentType } from "react";
import { referencedVariables } from "./go-template";
import { plainTextFromHtml, renderElement } from "./render";

/** The ways a Mail template's body is written (CONTEXT.md). Visual comes with the Visual editor. */
export type AuthoringMode = "jsx" | "html";

export interface SourceInput {
  mode: AuthoringMode;
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
}

export type RenderFailureReason =
  /** The source is not code Babel compiles, or it imports something not in scope. */
  | "compile"
  /** It compiles, but its default export is not a component. */
  | "no-component"
  /** Running or rendering it threw. */
  | "render"
  /** It rendered, and there is nothing in it. */
  | "empty";

export interface RenderFailure {
  ok: false;
  reason: RenderFailureReason;
  /** Says why, in words an operator can act on. */
  message: string;
}

export type RenderResult = Rendered | RenderFailure;

/** A render remembered with the source it was made from, which is what decideSave compares. */
export type SourceRender = RenderResult & SourceInput;

/** Sample values by field name, as a template's `meta.sample` holds them. */
export type SampleValues = Record<string, unknown>;

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
 * Renders a source. Never rejects: whatever goes wrong comes back as a
 * RenderFailure, and a failure carries no body, so there is nothing to save.
 */
export async function renderSource(input: SourceInput): Promise<SourceRender> {
  const result = input.mode === "html" ? renderHtml(input.source) : await renderJsx(input.source);
  return { ...result, mode: input.mode, source: input.source };
}

/**
 * Renders a template component already in hand. This is the Template seed's
 * and emails:render's way in; the panel compiles its component from the source
 * text first and then comes through here too.
 */
export async function renderComponent(Component: ComponentType): Promise<RenderResult> {
  try {
    const { html, plainText, markup } = await renderElement(createElement(Component));
    if (isBlank(markup)) {
      return EMPTY;
    }
    return { ok: true, html, plainText, variables: referencedVariables(html) };
  } catch (error) {
    return failure("render", `Şablon render edilirken hata verdi: ${messageOf(error)}`);
  }
}

async function renderJsx(source: string): Promise<RenderResult> {
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
  return renderComponent(Component);
}

/** Raw markup is the body as written; only its plain-text part is derived. */
function renderHtml(source: string): RenderResult {
  if (isBlank(source)) {
    return EMPTY;
  }
  try {
    return { ok: true, html: source, plainText: plainTextFromHtml(source), variables: referencedVariables(source) };
  } catch (error) {
    return failure("render", `Düz metin türetilemedi: ${messageOf(error)}`);
  }
}

/**
 * A stored body, or a subject, with sample values in place of its actions, so
 * a preview reads like a real mail. For display only; never saved. It takes
 * the rendered string rather than the source, so changing a sample value does
 * not need a new render.
 *
 * It is the approximation emails:render has always written its previews with:
 * every conditional section shows as if its value were present (an `{{else}}`
 * and its branch stay in), and a value goes in unescaped.
 */
export function fillSampleValues(body: string, sample: SampleValues): string {
  let filled = body;

  // Drop the conditionals, keeping the "value is present" branch.
  filled = filled.replace(/\{\{if [^}]+\}\}/g, "").replace(/\{\{end\}\}/g, "");
  filled = filled.replace(/\{\{safeHTML \.(\w+)\}\}/g, (_match, name: string) => String(sample[name] ?? ""));
  filled = filled.replace(/\{\{\.(\w+)\}\}/g, (_match, name: string) => String(sample[name] ?? `«${name}»`));

  return filled;
}

/**
 * What a save may write. A template row is saved as the body the editor
 * rendered, so a render that did not succeed must never reach the save: the
 * seed's pointer comment compiled to no component, the preview stayed empty,
 * and saving wrote that empty body over a template a live service sends by
 * key.
 *
 * But refusing every unrendered save would close a door ADR-0045 deliberately
 * opened: a system template's wording is edited in SkyMail without a release,
 * and the stored body of one the editor cannot render still travels back
 * unchanged under a new subject. So there are three outcomes, not two.
 */
export type SaveDecision =
  /** The editor rendered the source in it; save that render. */
  | "render"
  /** The source was never touched; save the wording and keep the stored body. */
  | "keep"
  /** The source was edited and has no render of its own; saving would destroy the body. */
  | "blocked";

/**
 * `editing` is the source in the editor now, `lastRender` the render it last
 * finished, and `storedSource` the source of the same Authoring mode the row
 * was loaded with — null when there is none yet, which is why creating a
 * template can only ever reach "render" or "blocked".
 *
 * Comparing the render's source with the editor's is what keeps a save from
 * riding on a stale render: the one a since-broken edit left on screen, and
 * the one the debounce has not replaced yet.
 */
export function decideSave(
  editing: SourceInput,
  lastRender: SourceRender | null,
  storedSource: string | null,
): SaveDecision {
  if (lastRender?.ok && lastRender.mode === editing.mode && lastRender.source === editing.source) {
    return "render";
  }
  return storedSource !== null && editing.source === storedSource ? "keep" : "blocked";
}
