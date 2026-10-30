/**
 * The preview fills the recipient's name tags as skymail-backend's mailer
 * does (internal/mailer/recipient_name.go): both repos hold the same cases.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  fallbackProblem,
  fillRecipientName,
  fillRecipientNameMarkup,
  hasRecipientNameTag,
  recipientName,
  recipientNameTag,
  splitRecipientNameTags,
} from "./recipient-name";

interface NameCase {
  name: string;
  value: string;
  fullName: string;
  expect: string;
}

/**
 * One file kept in two repos: this copy, and skymail-backend's
 * internal/mailer/testdata/recipient-name.json, whose test pins the same
 * hash. Changing either copy fails its own repo's test until both copies,
 * and both hashes, change together.
 */
const SHARED_CASES_SHA256 = "46ad04b6204b6ffb29353cd715ea4001f7cdfd2b485ab2d74b8b62058d774a54";
const raw = readFileSync(join(import.meta.dirname, "testdata", "recipient-name.json"));
const fixture = JSON.parse(raw.toString("utf8")) as { text: NameCase[]; markup: NameCase[] };

describe("the recipient's name, as the mailer fills it", () => {
  it("holds the cases skymail-backend holds", () => {
    assert.equal(
      createHash("sha256").update(raw).digest("hex"),
      SHARED_CASES_SHA256,
      "testdata/recipient-name.json değişmiş: skymail-backend'deki kopyayı (internal/mailer/testdata/recipient-name.json) da aynı yap, sonra iki sabiti de güncelle",
    );
    assert.ok(fixture.text.length > 0 && fixture.markup.length > 0);
  });

  for (const c of fixture.text) {
    it(`text: ${c.name}`, () => assert.equal(fillRecipientName(c.value, recipientName(c.fullName)), c.expect));
  }
  for (const c of fixture.markup) {
    it(`markup: ${c.name}`, () => assert.equal(fillRecipientNameMarkup(c.value, recipientName(c.fullName)), c.expect));
  }
});

describe("the tag", () => {
  it("is written with or without a fallback, and read back", () => {
    assert.equal(recipientNameTag(), "{{.FullName}}");
    assert.equal(recipientNameTag("katılımcı"), '{{or .FullName "katılımcı"}}');
    assert.deepEqual(splitRecipientNameTags(`Sayın ${recipientNameTag("katılımcı")}, ${recipientNameTag()}!`), [
      { text: "Sayın " },
      { tag: '{{or .FullName "katılımcı"}}', fallback: "katılımcı" },
      { text: ", " },
      { tag: "{{.FullName}}", fallback: "" },
      { text: "!" },
    ]);
    assert.equal(hasRecipientNameTag("{{.Email}} {{ .FullName }}"), false);
    assert.equal(hasRecipientNameTag("Merhaba {{.FullName}}"), true);
  });

  it("takes a fallback the mailer reads, and says why not another", () => {
    assert.equal(fallbackProblem(""), null);
    assert.equal(fallbackProblem("değerli katılımcı"), null);
    for (const bad of ['a"b', "a{b", "a}b", "a<b", "a&b", "a\\b", "a\nb", "ç".repeat(61)]) {
      assert.match(fallbackProblem(bad) ?? "", /yazılamaz/, bad);
      // What the editor refuses, the mailer would leave as text.
      assert.equal(fillRecipientName(`{{or .FullName "${bad}"}}`, "Ali"), `{{or .FullName "${bad}"}}`);
    }
  });
});
