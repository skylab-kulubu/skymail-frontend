/**
 * How the editor gets renders out of the sandbox: which frame a source runs
 * in, what comes back, and what happens when a frame never answers. The
 * frames here are stand-ins that behave like the real iframe (sandbox-frame.ts)
 * as seen through the protocol.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RenderResult, SourceInput } from "@/lib/mail-render";
import { createRenderBridge, type FrameFactory } from "./render-bridge";
import { RENDER_CHANNEL, type RenderRequest, type SandboxMessage } from "./render-protocol";

type Frame = {
  posted: RenderRequest[];
  disposed: boolean;
  send: (message: SandboxMessage) => void;
  ready: () => void;
  answer: (request: RenderRequest, result: RenderResult) => void;
};

const OK = (html: string): RenderResult => ({ ok: true, html, plainText: html, variables: [] });

/**
 * Frames that stay silent until the test speaks for them, or — with
 * `answering` — get ready at once and answer every request the way the
 * sandbox does.
 */
function sandbox({ answering }: { answering?: (input: SourceInput, frame: number) => RenderResult } = {}) {
  const frames: Frame[] = [];
  const createFrame: FrameFactory = (listener) => {
    const frame: Frame = {
      posted: [],
      disposed: false,
      send: (message) => listener(message),
      ready: () => listener({ channel: RENDER_CHANNEL, type: "ready" }),
      answer: (request, result) => listener({ channel: RENDER_CHANNEL, type: "rendered", id: request.id, result }),
    };
    const index = frames.push(frame) - 1;
    if (answering) setTimeout(() => frame.ready(), 0);
    return {
      post(request) {
        frame.posted.push(request);
        if (answering) setTimeout(() => frame.answer(request, answering(request.input, index)), 0);
      },
      dispose() {
        frame.disposed = true;
      },
    };
  };
  return { frames, createFrame };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("where a source is rendered", () => {
  it("runs each JSX source in a frame that has run no other, and throws that frame away", async () => {
    const { frames, createFrame } = sandbox({ answering: (input, frame) => OK(`${input.source} in frame ${frame}`) });
    const bridge = createRenderBridge({ createFrame });

    const first = await bridge.render({ mode: "jsx", source: "A" });
    const second = await bridge.render({ mode: "jsx", source: "B" });

    assert.equal(first?.ok && first.html, "A in frame 0");
    assert.equal(second?.ok && second.html, "B in frame 1");
    assert.equal(frames[0].posted.length, 1);
    assert.equal(frames[1].posted.length, 1);
    assert.ok(frames[0].disposed && frames[1].disposed);
    bridge.dispose();
  });

  it("renders HTML, which runs nothing, in the same clean frame", async () => {
    const { frames, createFrame } = sandbox({ answering: (input, frame) => OK(`${input.source} in frame ${frame}`) });
    const bridge = createRenderBridge({ createFrame });

    await bridge.render({ mode: "html", source: "<p>1</p>" });
    const second = await bridge.render({ mode: "html", source: "<p>2</p>" });
    const jsx = await bridge.render({ mode: "jsx", source: "A" });
    const after = await bridge.render({ mode: "html", source: "<p>3</p>" });

    assert.equal(second?.ok && second.html, "<p>2</p> in frame 0");
    assert.equal(jsx?.ok && jsx.html, "A in frame 0");
    assert.equal(after?.ok && after.html, "<p>3</p> in frame 1", "not the frame the JSX ran in");
    assert.equal(frames[0].disposed, true);
    bridge.dispose();
  });

  // A Visual document is data the render module reads, like HTML; it runs no code.
  it("renders a Visual document in the same clean frame as HTML, and never in one JSX ran in", async () => {
    const { createFrame } = sandbox({ answering: (input, frame) => OK(`${input.mode} in frame ${frame}`) });
    const bridge = createRenderBridge({ createFrame });

    const visual = await bridge.render({ mode: "visual", source: '{"type":"skymail.visual","version":1,"blocks":[]}' });
    const html = await bridge.render({ mode: "html", source: "<p>1</p>" });
    await bridge.render({ mode: "jsx", source: "A" });
    const after = await bridge.render({ mode: "visual", source: '{"type":"skymail.visual","version":1,"blocks":[]}' });

    assert.equal(visual?.ok && visual.html, "visual in frame 0");
    assert.equal(html?.ok && html.html, "html in frame 0");
    assert.equal(after?.ok && after.html, "visual in frame 1");
    bridge.dispose();
  });

  it("keeps a clean frame loading for the next render once asked to", async () => {
    const { frames, createFrame } = sandbox({ answering: () => OK("x") });
    const bridge = createRenderBridge({ createFrame });
    bridge.warm();
    assert.equal(frames.length, 1);
    await bridge.render({ mode: "jsx", source: "A" });
    await tick();
    assert.equal(frames.length, 2, "a new frame starts loading when the used one goes");
    assert.equal(frames[1].posted.length, 0);
    bridge.dispose();
    assert.equal(frames[1].disposed, true);
  });
});

describe("what a render says", () => {
  it("carries the mode and source the editor asked for", async () => {
    const { frames, createFrame } = sandbox();
    const bridge = createRenderBridge({ createFrame });
    const pending = bridge.render({ mode: "jsx", source: "export default Mail" });
    frames[0].ready();
    await tick();
    frames[0].answer(frames[0].posted[0], OK("<p>mail</p>"));

    assert.deepEqual(await pending, {
      ok: true,
      html: "<p>mail</p>",
      plainText: "<p>mail</p>",
      variables: [],
      mode: "jsx",
      source: "export default Mail",
    });
    bridge.dispose();
  });

  it("waits for the frame to be ready before sending it anything", async () => {
    const { frames, createFrame } = sandbox();
    const bridge = createRenderBridge({ createFrame });
    const pending = bridge.render({ mode: "html", source: "<p/>" });
    await tick();
    assert.equal(frames[0].posted.length, 0);
    frames[0].ready();
    await tick();
    assert.equal(frames[0].posted.length, 1);
    frames[0].answer(frames[0].posted[0], OK("<p/>"));
    assert.equal((await pending)?.ok, true);
    bridge.dispose();
  });

  it("ignores an answer to another request", async () => {
    const { frames, createFrame } = sandbox();
    const bridge = createRenderBridge({ createFrame });
    const pending = bridge.render({ mode: "html", source: "<p>mine</p>" });
    frames[0].ready();
    await tick();
    frames[0].send({ channel: RENDER_CHANNEL, type: "rendered", id: "forged", result: OK("<p>not mine</p>") });
    frames[0].answer(frames[0].posted[0], OK("<p>mine</p>"));
    const render = await pending;
    assert.equal(render?.ok && render.html, "<p>mine</p>");
    bridge.dispose();
  });

  it("is a failure when the frame does not answer in time, and that frame is not used again", async () => {
    const { frames, createFrame } = sandbox();
    const bridge = createRenderBridge({ createFrame, answerWithinMs: 20 });
    const pending = bridge.render({ mode: "html", source: "<p/>" });
    frames[0].ready();

    const render = await pending;
    assert.equal(render?.ok, false);
    assert.equal(!render?.ok && render?.reason, "render");
    assert.match((!render?.ok && render?.message) || "", /bitmedi/);
    assert.equal(frames[0].disposed, true);

    const next = bridge.render({ mode: "html", source: "<p>2</p>" });
    await tick();
    assert.ok(frames.length >= 2 && frames.at(-1)!.disposed === false);
    bridge.dispose();
    assert.equal(await next, null);
  });

  it("is a failure when the frame never loads", async () => {
    const { frames, createFrame } = sandbox();
    const bridge = createRenderBridge({ createFrame, readyWithinMs: 20 });
    const render = await bridge.render({ mode: "jsx", source: "A" });
    assert.equal(render?.ok, false);
    assert.match((!render?.ok && render?.message) || "", /yüklenemedi/);
    assert.equal(frames[0].posted.length, 0, "nothing is sent to a frame that never said it was ready");
    assert.equal(frames[0].disposed, true);
    bridge.dispose();
  });

  it("does not hear a frame once it is thrown away", async () => {
    const { frames, createFrame } = sandbox();
    const bridge = createRenderBridge({ createFrame, answerWithinMs: 20 });
    const first = bridge.render({ mode: "jsx", source: "A" });
    frames[0].ready();
    assert.equal((await first)?.ok, false);

    const second = bridge.render({ mode: "html", source: "<p/>" });
    await tick();
    // The old frame answers late, with the id the new request might carry.
    const next = frames.at(-1)!;
    next.ready();
    await tick();
    frames[0].answer(next.posted[0], OK("<p>from the old frame</p>"));
    next.answer(next.posted[0], OK("<p>fresh</p>"));
    const render = await second;
    assert.equal(render?.ok && render.html, "<p>fresh</p>");
    bridge.dispose();
  });
});

describe("renders waiting their turn", () => {
  it("are rendered one at a time, in order", async () => {
    const order: string[] = [];
    const { createFrame } = sandbox({
      answering: (input) => {
        order.push(input.source);
        return OK(input.source);
      },
    });
    const bridge = createRenderBridge({ createFrame });
    const results = await Promise.all([
      bridge.render({ mode: "jsx", source: "main" }),
      bridge.render({ mode: "html", source: "other" }),
    ]);
    assert.deepEqual(order, ["main", "other"]);
    assert.deepEqual(
      results.map((render) => render?.ok && render.html),
      ["main", "other"],
    );
    bridge.dispose();
  });

  it("give way to a newer source of the same mode: the older one comes back empty", async () => {
    const rendered: string[] = [];
    const { createFrame } = sandbox({
      answering: (input) => {
        rendered.push(input.source);
        return OK(input.source);
      },
    });
    const bridge = createRenderBridge({ createFrame });
    const running = bridge.render({ mode: "jsx", source: "v1" });
    const replaced = bridge.render({ mode: "jsx", source: "v2" });
    const latest = bridge.render({ mode: "jsx", source: "v3" });

    assert.equal((await running)?.ok, true);
    assert.equal(await replaced, null);
    assert.equal((await latest)?.source, "v3");
    assert.deepEqual(rendered, ["v1", "v3"]);
    bridge.dispose();
  });

  it("come back empty when the editor goes away", async () => {
    const { frames, createFrame } = sandbox();
    const bridge = createRenderBridge({ createFrame });
    const running = bridge.render({ mode: "jsx", source: "A" });
    const waiting = bridge.render({ mode: "html", source: "<p/>" });
    bridge.dispose();
    assert.equal(await running, null);
    assert.equal(await waiting, null);
    assert.ok(frames.every((frame) => frame.disposed));
  });
});
