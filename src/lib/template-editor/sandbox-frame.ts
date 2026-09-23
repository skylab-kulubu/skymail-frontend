/**
 * The frame the editor renders in: an iframe with `sandbox="allow-scripts"`
 * and nothing else, so its document has an opaque origin. Code compiled there
 * cannot read the panel's cookies or storage, cannot reach into the page
 * (`parent.document` is another origin), and its requests to the panel carry
 * no session: a fetch from an opaque origin is cross-site, so the Auth.js
 * cookie stays behind, and the panel's answers have no CORS headers for it to
 * read. A Web Worker the page started would not do — it runs with the
 * page's own origin; the worker the frame starts to render in
 * (src/render-sandbox/frame.ts) has the frame's opaque origin instead.
 *
 * The document it loads, /render-sandbox/index.html, is built by
 * scripts/build-editor-assets.ts from src/render-sandbox/ and served with a
 * `sandbox` CSP of its own (next.config.ts), so it is opaque even if someone
 * frames it without the attribute.
 */
import type { FrameFactory } from "./render-bridge";
import { readSandboxMessage, type RenderRequest } from "./render-protocol";

export const RENDER_SANDBOX_URL = "/render-sandbox/index.html";

/** The only flag the frame gets: it runs scripts, with an origin of its own. */
export const RENDER_SANDBOX_FLAGS = "allow-scripts";

export function iframeSandbox(): FrameFactory {
  return (listener) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", RENDER_SANDBOX_FLAGS);
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("data-render-sandbox", "");
    iframe.tabIndex = -1;
    iframe.title = "Render ortamı";
    iframe.style.display = "none";
    iframe.src = RENDER_SANDBOX_URL;

    // Only this iframe's window may speak (event.source). Every document in a
    // sandboxed iframe has an opaque origin, one it navigated to included, so
    // "null" tells no two documents apart; it only refuses a frame that is
    // somehow not sandboxed.
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || event.origin !== "null") return;
      const message = readSandboxMessage(event.data);
      if (message) listener(message);
    };
    window.addEventListener("message", onMessage);
    document.body.append(iframe);

    return {
      // An opaque origin cannot be named as a target, so "*". What keeps a
      // request away from code another source left behind is that every JSX
      // source gets a frame of its own (render-bridge.ts), sent its one
      // request before that code runs. Reusing a frame after it has run JSX
      // would break that.
      post(request: RenderRequest) {
        iframe.contentWindow?.postMessage(request, "*");
      },
      dispose() {
        window.removeEventListener("message", onMessage);
        iframe.remove();
      },
    };
  };
}
