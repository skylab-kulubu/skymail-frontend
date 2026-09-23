/**
 * The messages between the editor and the render sandbox. The sandbox runs
 * code an operator wrote, so whatever comes out of it is read as untrusted
 * input: only the shapes below are taken, field by field.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RENDER_CHANNEL, readRenderRequest, readSandboxMessage, renderRequest } from "./render-protocol";

describe("a render request, as the sandbox reads it", () => {
  it("is what the editor sends", () => {
    const request = renderRequest("r1", { mode: "jsx", source: "export default () => null" });
    assert.deepEqual(readRenderRequest(structuredClone(request)), {
      channel: RENDER_CHANNEL,
      type: "render",
      id: "r1",
      input: { mode: "jsx", source: "export default () => null" },
    });
  });

  it("carries a Visual source, the document's JSON text", () => {
    const request = renderRequest("r2", { mode: "visual", source: '{"type":"skymail.visual","version":1,"blocks":[]}' });
    assert.deepEqual(readRenderRequest(structuredClone(request))?.input, request.input);
  });

  it("is nothing else", () => {
    const good = renderRequest("r1", { mode: "html", source: "<p>x</p>" });
    for (const other of [
      null,
      "render",
      { ...good, channel: "other" },
      { ...good, type: "ready" },
      { ...good, id: 7 },
      { ...good, id: "" },
      { ...good, input: { mode: "mjml", source: "<mjml/>" } },
      { ...good, input: { mode: "html", source: 5 } },
      { ...good, input: null },
    ]) {
      assert.equal(readRenderRequest(other), null, JSON.stringify(other));
    }
  });
});

describe("a sandbox message, as the editor reads it", () => {
  it("says the sandbox is ready", () => {
    assert.deepEqual(readSandboxMessage({ channel: RENDER_CHANNEL, type: "ready" }), {
      channel: RENDER_CHANNEL,
      type: "ready",
    });
  });

  it("carries a render, and only the fields a render has", () => {
    const message = readSandboxMessage({
      channel: RENDER_CHANNEL,
      type: "rendered",
      id: "r1",
      result: {
        ok: true,
        html: "<p>{{.FirstName}}</p>",
        plainText: "{{.FirstName}}",
        variables: ["FirstName"],
        warnings: ["Bağlantıdan sonra bir boşluk bırak."],
        // A sandbox cannot say which source it rendered: the editor knows.
        mode: "html",
        source: "something else",
        extra: "dropped",
      },
    });
    assert.deepEqual(message, {
      channel: RENDER_CHANNEL,
      type: "rendered",
      id: "r1",
      result: {
        ok: true,
        html: "<p>{{.FirstName}}</p>",
        plainText: "{{.FirstName}}",
        variables: ["FirstName"],
        warnings: ["Bağlantıdan sonra bir boşluk bırak."],
      },
    });
  });

  for (const [reason, text] of [
    ["compile", "Kod derlenemedi: …"],
    ["invalid", 'Visual belge okunamadı: blocks[0]: bilinmeyen blok "quote"'],
  ]) {
    it(`carries a failure with its reason and message: ${reason}`, () => {
      const message = readSandboxMessage({
        channel: RENDER_CHANNEL,
        type: "rendered",
        id: "r2",
        result: { ok: false, reason, message: text },
      });
      assert.deepEqual(message?.type === "rendered" && message.result, { ok: false, reason, message: text });
    });
  }

  it("is nothing when it is not a message the protocol has", () => {
    const rendered = (result: unknown) => ({ channel: RENDER_CHANNEL, type: "rendered", id: "r1", result });
    for (const other of [
      undefined,
      { channel: "webpack", type: "ready" },
      { channel: RENDER_CHANNEL, type: "render", id: "r1", input: { mode: "html", source: "" } },
      { channel: RENDER_CHANNEL, type: "rendered", result: { ok: false, reason: "render", message: "x" } },
      rendered(null),
      rendered({ ok: "yes", html: "", plainText: "", variables: [] }),
      rendered({ ok: true, plainText: "", variables: [] }),
      rendered({ ok: true, html: "<p/>", plainText: 1, variables: [] }),
      rendered({ ok: true, html: "<p/>", plainText: "", variables: "FirstName" }),
      rendered({ ok: true, html: "<p/>", plainText: "", variables: [1], warnings: [] }),
      rendered({ ok: true, html: "<p/>", plainText: "", variables: [] }),
      rendered({ ok: true, html: "<p/>", plainText: "", variables: [], warnings: "boşluk bırak" }),
      rendered({ ok: true, html: "<p/>", plainText: "", variables: [], warnings: [{ text: "x" }] }),
      rendered({ ok: false, reason: "pwned", message: "x" }),
      rendered({ ok: false, reason: "render" }),
    ]) {
      assert.equal(readSandboxMessage(other), null, JSON.stringify(other));
    }
  });
});
