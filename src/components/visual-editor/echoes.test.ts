/**
 * The Visual editor hands each change out, and the page hands the text back
 * as its value some renders later. A value the editor did not hand out is a
 * change from outside — a set-back source, a reload — and replaces what is in
 * the editor. One of its own, even an older one arriving late behind a newer
 * keystroke, must not: that would throw away what was typed since.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEchoes } from "./echoes";

describe("telling the editor's own values from the page's", () => {
  it("takes the value it opened with as its own", () => {
    const echoes = createEchoes("a");
    assert.equal(echoes.isOutside("a"), false);
  });

  it("takes an older value of its own, arriving after a newer one was handed out, as its own", () => {
    const echoes = createEchoes("a");
    echoes.handedOut("ab");
    echoes.handedOut("abc");

    assert.equal(echoes.isOutside("ab"), false);
    assert.equal(echoes.isOutside("abc"), false);
  });

  it("takes a value it never handed out as a change from outside, and what it hands out after as its own", () => {
    const echoes = createEchoes("a");
    echoes.handedOut("ab");

    assert.equal(echoes.isOutside("x"), true);
    assert.equal(echoes.isOutside("x"), false);
    echoes.handedOut("xy");
    assert.equal(echoes.isOutside("xy"), false);
  });

  it("forgets its older values once the page has caught up, so setting one back is from outside", () => {
    const echoes = createEchoes("a");
    echoes.handedOut("ab");
    echoes.handedOut("abc");
    assert.equal(echoes.isOutside("abc"), false);

    assert.equal(echoes.isOutside("a"), true);
  });
});
