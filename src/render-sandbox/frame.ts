/**
 * The render sandbox: the page inside the editor's sandboxed iframe (see
 * src/lib/template-editor/sandbox-frame.ts). It answers the editor's render
 * requests over postMessage, and holds no session, no API client and no
 * Next.js.
 *
 * It does not render itself. Each render runs in a worker it starts from a
 * blob URL (worker.ts), which has the frame's opaque origin and a thread of
 * its own. A source stuck in a synchronous loop — `while (true) {}` — would
 * otherwise block this frame's thread, and wherever the browser keeps the
 * frame in the editor's process, the editor's thread with it, with no timer
 * left to stop it. Here the frame's thread stays free: at the deadline it
 * terminates the worker and answers with a failure.
 *
 * An engine that will not start a worker from an opaque origin gets the
 * render module loaded into the frame itself: renders still work, and the
 * editor's own timeout (render-bridge.ts) is all that stands between a loop
 * and the page there.
 *
 * Not part of the Next.js app: scripts/build-editor-assets.ts bundles this
 * file and worker.ts into classic scripts under public/render-sandbox/. A
 * module script or a lazy chunk from an opaque origin would be a CORS request
 * the panel's static files do not answer.
 */
import type { RenderFailure, RenderResult, SourceInput } from "@/lib/mail-render";
import { RENDER_CHANNEL, readRenderRequest, type SandboxMessage } from "@/lib/template-editor/render-protocol";
import type { WorkerAnswer, WorkerRequest } from "./worker";

/** How long one render may run before the frame stops it: longer than the render module's own async deadline. */
const RENDER_TIMEOUT_MS = 10_000;

/** How long the worker may take to load the render module before the frame renders without it. */
const WORKER_LOAD_MS = 10_000;

const failure = (message: string): RenderFailure => ({ ok: false, reason: "render", message });

const TIMED_OUT = failure(
  `Render ${RENDER_TIMEOUT_MS / 1000} saniye içinde bitmedi ve durduruldu; kod hiç bitmeyen bir döngüde olabilir.`,
);

/** The worker script, named by index.html (its file name carries a hash). */
const workerScript = new URL((document.currentScript as HTMLScriptElement).dataset.worker ?? "", document.baseURI).href;

type Renderer = (input: SourceInput) => Promise<RenderResult>;

/** A worker with the render module in it, started from a blob URL so it has this frame's opaque origin. Throws where the engine refuses. */
function startWorker(): Worker {
  const bootstrap = new Blob([`importScripts(${JSON.stringify(workerScript)});`], { type: "text/javascript" });
  return new Worker(URL.createObjectURL(bootstrap));
}

/** The first worker, once it has loaded the render module; null when this engine does not start one or it does not load. */
function firstWorker(): Promise<Worker | null> {
  let worker: Worker;
  try {
    worker = startWorker();
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const fail = () => {
      clearTimeout(timer);
      worker.terminate();
      resolve(null);
    };
    const timer = setTimeout(fail, WORKER_LOAD_MS);
    worker.onerror = fail;
    worker.onmessage = (event: MessageEvent<WorkerAnswer>) => {
      if (!("ready" in event.data)) return;
      clearTimeout(timer);
      worker.onerror = null;
      resolve(worker);
    };
  });
}

/**
 * Renders in the worker, one render at a time as the editor sends them. A
 * render past the deadline gets a failure, and its worker is terminated with
 * the code still running in it; the next render starts a new one.
 */
function inWorkers(first: Worker): Renderer {
  let worker: Worker | null = first;
  let requests = 0;
  return (input) =>
    new Promise((settle) => {
      worker ??= startWorker();
      const target = worker;
      requests += 1;
      const id = `w${requests}`;
      const timer = setTimeout(() => {
        target.terminate();
        if (worker === target) worker = null;
        settle(TIMED_OUT);
      }, RENDER_TIMEOUT_MS);
      target.onmessage = (event: MessageEvent<WorkerAnswer>) => {
        const answer = event.data;
        if (!("id" in answer) || answer.id !== id) return;
        clearTimeout(timer);
        settle(answer.result);
      };
      const request: WorkerRequest = { id, input };
      target.postMessage(request);
    });
}

/** The render module loaded into the frame itself, for an engine without a worker here. */
function loadInFrame(): Promise<Renderer | null> {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = workerScript;
    script.onload = () => resolve((globalThis as { skymailRender?: Renderer }).skymailRender ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

const renderer: Promise<Renderer | null> = firstWorker().then((worker) => (worker ? inWorkers(worker) : loadInFrame()));

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const request = readRenderRequest(event.data);
  if (!request) return;
  void renderer
    .then((render) => (render ? render(request.input) : failure("Render modülü yüklenemedi.")))
    .then((result) => {
      const reply: SandboxMessage = { channel: RENDER_CHANNEL, type: "rendered", id: request.id, result };
      window.parent.postMessage(reply, event.origin);
    });
});

void renderer.then((render) => {
  if (!render) return;
  const ready: SandboxMessage = { channel: RENDER_CHANNEL, type: "ready" };
  window.parent.postMessage(ready, "*");
});
