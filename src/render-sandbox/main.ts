/**
 * The render sandbox: the page inside the editor's sandboxed iframe (see
 * src/lib/template-editor/sandbox-frame.ts). It holds the render module and
 * nothing else — no session, no API client, no Next.js — and answers the
 * editor's render requests over postMessage.
 *
 * Not part of the Next.js app: scripts/build-editor-assets.ts bundles it into
 * one classic script under public/render-sandbox/. A classic script, because
 * a module script from an opaque origin is a CORS request the panel's static
 * files do not answer, and one file, because every JSX render gets a fresh
 * frame that should not wait on chunk after chunk.
 */
import { renderSource, type RenderResult } from "@/lib/mail-render";
import { RENDER_CHANNEL, readRenderRequest, type SandboxMessage } from "@/lib/template-editor/render-protocol";

/** The render without the source it echoes: the editor knows what it asked for. */
async function render(input: Parameters<typeof renderSource>[0]): Promise<RenderResult> {
  try {
    const rendered = await renderSource(input);
    return rendered.ok
      ? { ok: true, html: rendered.html, plainText: rendered.plainText, variables: rendered.variables }
      : { ok: false, reason: rendered.reason, message: rendered.message };
  } catch (error) {
    return { ok: false, reason: "render", message: error instanceof Error ? error.message : String(error) };
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const request = readRenderRequest(event.data);
  if (!request) return;
  void render(request.input).then((result) => {
    const reply: SandboxMessage = { channel: RENDER_CHANNEL, type: "rendered", id: request.id, result };
    window.parent.postMessage(reply, event.origin);
  });
});

const ready: SandboxMessage = { channel: RENDER_CHANNEL, type: "ready" };
window.parent.postMessage(ready, "*");
