/**
 * The messages between the editor and the render sandbox.
 *
 * Rendering a JSX source runs the code in it, so the editor never renders in
 * its own page: it asks an iframe with an opaque origin (see sandbox-frame.ts
 * and src/render-sandbox/), which holds the render module and nothing of the
 * operator's session. A source goes in; the render — HTML, plain text and the
 * variables it references, or why there is none — comes out.
 *
 * Whatever the sandbox sends was produced next to that code, so the editor
 * reads it as untrusted input: only the shapes below, field by field, and
 * never the source a render claims to be of — the editor knows what it asked.
 */
import type { AuthoringMode, RenderFailureReason, RenderResult, SourceInput } from "@/lib/mail-render";

/** Marks this protocol's messages among whatever else a window receives. */
export const RENDER_CHANNEL = "skymail.render-sandbox.v1";

/** Editor → sandbox: render this source. */
export type RenderRequest = Readonly<{
  channel: typeof RENDER_CHANNEL;
  type: "render";
  id: string;
  input: SourceInput;
}>;

/** Sandbox → editor: the render module is loaded and listening. */
export type SandboxReady = Readonly<{ channel: typeof RENDER_CHANNEL; type: "ready" }>;

/** Sandbox → editor: the render of request `id`. */
export type SandboxRendered = Readonly<{
  channel: typeof RENDER_CHANNEL;
  type: "rendered";
  id: string;
  result: RenderResult;
}>;

export type SandboxMessage = SandboxReady | SandboxRendered;

const MODES: readonly AuthoringMode[] = ["jsx", "html"];
const FAILURE_REASONS: readonly RenderFailureReason[] = ["compile", "no-component", "render", "empty", "invalid"];

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields => typeof value === "object" && value !== null;

const isId = (value: unknown): value is string => typeof value === "string" && value !== "";

function ofProtocol(data: unknown): data is Fields {
  return isObject(data) && data.channel === RENDER_CHANNEL;
}

export function renderRequest(id: string, input: SourceInput): RenderRequest {
  return { channel: RENDER_CHANNEL, type: "render", id, input: { mode: input.mode, source: input.source } };
}

/** A render request, as the sandbox reads what arrives; null for anything else. */
export function readRenderRequest(data: unknown): RenderRequest | null {
  if (!ofProtocol(data) || data.type !== "render" || !isId(data.id) || !isObject(data.input)) return null;
  const { mode, source } = data.input;
  if (!MODES.includes(mode as AuthoringMode) || typeof source !== "string") return null;
  return renderRequest(data.id, { mode: mode as AuthoringMode, source });
}

function readResult(value: unknown): RenderResult | null {
  if (!isObject(value)) return null;
  if (value.ok === true) {
    const { html, plainText, variables } = value;
    if (typeof html !== "string" || typeof plainText !== "string") return null;
    if (!Array.isArray(variables) || !variables.every((name) => typeof name === "string")) return null;
    return { ok: true, html, plainText, variables: [...variables] };
  }
  if (value.ok === false) {
    const { reason, message } = value;
    if (!FAILURE_REASONS.includes(reason as RenderFailureReason) || typeof message !== "string") return null;
    return { ok: false, reason: reason as RenderFailureReason, message };
  }
  return null;
}

/** A sandbox message, as the editor reads what arrives; null for anything else. */
export function readSandboxMessage(data: unknown): SandboxMessage | null {
  if (!ofProtocol(data)) return null;
  if (data.type === "ready") return { channel: RENDER_CHANNEL, type: "ready" };
  if (data.type !== "rendered" || !isId(data.id)) return null;
  const result = readResult(data.result);
  return result ? { channel: RENDER_CHANNEL, type: "rendered", id: data.id, result } : null;
}
