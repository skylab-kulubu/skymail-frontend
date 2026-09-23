/**
 * How the editor gets renders: from a sandboxed frame, one render at a time.
 *
 * A JSX source is code, and the code it compiles to runs in the frame's
 * worker (src/render-sandbox/), so a frame renders at most one JSX source and
 * is thrown away after it: that source cannot leave anything behind for the
 * next — patch the renderer so a later source renders as it likes, keep a
 * timer running. HTML and a Visual document are only read, never run, so
 * their renders share a frame until it runs JSX. While the editor is open, a
 * clean frame is kept loading for the next render, so a render waits for the
 * frame to load only the first time.
 *
 * A render that never finishes is stopped in the frame, which terminates its
 * worker at a deadline and answers with a failure. A frame that does not
 * answer at all by this module's own, later deadline is dropped. That timer
 * runs on the editor's thread, so it cannot help where the loop holds that
 * thread: in an engine that will not start the frame's worker, the frame
 * renders itself, and a synchronous loop there can hold the editor until the
 * browser stops the frame.
 *
 * The frames themselves (sandbox-frame.ts) are iframes; this module only needs
 * to post to them and hear from them, so it runs in Node tests as it does in
 * the page.
 */
import type { RenderFailure, RenderResult, SourceInput, SourceRender } from "@/lib/mail-render";
import { renderRequest, type RenderRequest, type SandboxMessage } from "./render-protocol";

/** One sandbox the bridge talks to. */
export interface SandboxFrame {
  post(request: RenderRequest): void;
  /** Removes the frame. */
  dispose(): void;
}

/** Makes a frame that reports each protocol message it sends to `listener`, and nothing else. */
export type FrameFactory = (listener: (message: SandboxMessage) => void) => SandboxFrame;

export interface RenderBridgeOptions {
  createFrame: FrameFactory;
  /** How long a render may take once sent. The render module stops a slow async render at 10 s itself. */
  answerWithinMs?: number;
  /** How long a frame may take to load the render module. */
  readyWithinMs?: number;
}

export interface RenderBridge {
  /**
   * The render of `input`, or null when a newer source of the same mode took
   * its place before it was rendered, or the bridge was disposed.
   */
  render(input: SourceInput): Promise<SourceRender | null>;
  /** Starts loading a frame now, so the first render does not wait for it. */
  warm(): void;
  /** Removes every frame; renders still waiting come back null. */
  dispose(): void;
}

type Slot = {
  frame: SandboxFrame;
  ready: Promise<boolean>;
  /** Ran a JSX source: never used again. */
  spent: boolean;
  disposed: boolean;
  onRendered: ((id: string, result: RenderResult) => void) | null;
  dispose(): void;
};

type Job = { input: SourceInput; settle: (render: SourceRender | null) => void };

const failure = (message: string): RenderFailure => ({ ok: false, reason: "render", message });

const UNAVAILABLE = failure("Önizleme ortamı yüklenemedi; sayfayı yenileyip tekrar dene.");

export function createRenderBridge({
  createFrame,
  answerWithinMs = 20_000,
  readyWithinMs = 20_000,
}: RenderBridgeOptions): RenderBridge {
  let slot: Slot | null = null;
  let requests = 0;
  let disposed = false;
  const waiting: Job[] = [];
  let running: Job | null = null;
  let abandon: (() => void) | null = null;

  function openSlot(): Slot {
    let settleReady: (ready: boolean) => void = () => {};
    const ready = new Promise<boolean>((resolve) => {
      settleReady = resolve;
    });
    const readyTimer = setTimeout(() => settleReady(false), readyWithinMs);
    const opened: Slot = {
      frame: undefined as unknown as SandboxFrame,
      ready,
      spent: false,
      disposed: false,
      onRendered: null,
      dispose() {
        if (opened.disposed) return;
        opened.disposed = true;
        clearTimeout(readyTimer);
        settleReady(false);
        opened.frame.dispose();
      },
    };
    opened.frame = createFrame((message) => {
      if (opened.disposed) return;
      if (message.type === "ready") {
        clearTimeout(readyTimer);
        settleReady(true);
      } else {
        opened.onRendered?.(message.id, message.result);
      }
    });
    return opened;
  }

  function cleanSlot(): Slot {
    if (!slot || slot.spent || slot.disposed) slot = openSlot();
    return slot;
  }

  function drop(used: Slot) {
    used.dispose();
    if (slot === used) slot = null;
  }

  /** Sends one request and waits for its answer, a timeout, or the bridge going away. */
  function ask(used: Slot, input: SourceInput): Promise<RenderResult | null> {
    requests += 1;
    const request = renderRequest(`r${requests}`, input);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        finish(failure(`Render ${Math.round(answerWithinMs / 1000)} saniye içinde bitmedi; kod hiç bitmeyen bir döngüde olabilir.`));
        drop(used);
      }, answerWithinMs);
      function finish(result: RenderResult | null) {
        clearTimeout(timer);
        used.onRendered = null;
        abandon = null;
        resolve(result);
      }
      used.onRendered = (id, result) => {
        if (id === request.id) finish(result);
      };
      abandon = () => finish(null);
      used.frame.post(request);
    });
  }

  async function renderOne({ mode, source }: SourceInput): Promise<SourceRender | null> {
    const used = cleanSlot();
    if (mode === "jsx") used.spent = true;

    let result: RenderResult | null;
    if (await used.ready) {
      result = await ask(used, { mode, source });
    } else {
      result = disposed ? null : UNAVAILABLE;
      drop(used);
    }
    if (used.spent) drop(used);
    if (!disposed) cleanSlot();
    return result && { ...result, mode, source };
  }

  async function drain() {
    if (running) return;
    while (!disposed && waiting.length > 0) {
      running = waiting.shift()!;
      running.settle(await renderOne(running.input));
      running = null;
    }
  }

  return {
    render(input) {
      if (disposed) return Promise.resolve(null);
      return new Promise((settle) => {
        const replaced = waiting.findIndex((job) => job.input.mode === input.mode);
        if (replaced >= 0) waiting.splice(replaced, 1)[0].settle(null);
        waiting.push({ input: { mode: input.mode, source: input.source }, settle });
        void drain();
      });
    },
    warm() {
      if (!disposed) cleanSlot();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abandon?.();
      slot?.dispose();
      slot = null;
      for (const job of waiting.splice(0)) job.settle(null);
    },
  };
}
