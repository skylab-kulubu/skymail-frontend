/**
 * The render sandbox's worker: the render module, where a source's code runs.
 *
 * frame.ts starts it inside the sandboxed iframe from a blob URL, so it has
 * the frame's opaque origin, no DOM, and a thread of its own: code stuck in
 * a loop here stops only this worker, which the frame terminates at its
 * deadline, and never the editor's page.
 *
 * The same script also loads into the frame as a plain script, for an engine
 * that will not start a worker from the opaque origin; it then only exposes
 * `render` (see frame.ts).
 */
// First: before anything that can load Prism.
import "./quiet-prism";
import { renderSource, type RenderResult, type SourceInput } from "@/lib/mail-render";

/** How long the render module lets a render wait on something asynchronous; the frame's own deadline is longer. */
export const RENDER_DEADLINE_MS = 8_000;

/** What the worker answers: the render of request `id`, without the source it echoes. */
export type WorkerAnswer = { id: string; result: RenderResult } | { ready: true };

export type WorkerRequest = { id: string; input: SourceInput };

async function render(input: SourceInput): Promise<RenderResult> {
  try {
    const rendered = await renderSource(input, { deadlineMs: RENDER_DEADLINE_MS });
    return rendered.ok
      ? { ok: true, html: rendered.html, plainText: rendered.plainText, variables: rendered.variables }
      : { ok: false, reason: rendered.reason, message: rendered.message };
  } catch (error) {
    return { ok: false, reason: "render", message: error instanceof Error ? error.message : String(error) };
  }
}

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerAnswer): void;
};

const scope = globalThis as unknown as { importScripts?: unknown; skymailRender?: typeof render };

if (typeof scope.importScripts === "function") {
  const worker = globalThis as unknown as WorkerScope;
  worker.onmessage = (event) => {
    const { id, input } = event.data;
    void render(input).then((result) => worker.postMessage({ id, result }));
  };
  worker.postMessage({ ready: true });
} else {
  scope.skymailRender = render;
}
