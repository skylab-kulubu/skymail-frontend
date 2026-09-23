/**
 * Story 41: a Template seed refused because an operator changed the template
 * (ADR-0047, ticket 09's `seed_refusal`) is said on the template in plain
 * Turkish — when, which rule held, and what forcing it would do — so the
 * operator knows a repo change is waiting on a decision.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seedRefusalBadge, seedRefusalText, seedRuleText } from "./seed-refusal";

const refusal = (rules: string[]) => ({
  refused_at: "2026-09-22T21:10:00Z",
  rules,
  payload_sha256: "a".repeat(64),
});

describe("a refused Template seed", () => {
  it("is nothing to say when no seed is refused", () => {
    assert.equal(seedRefusalText(null), null);
    assert.equal(seedRefusalText(undefined), null);
    assert.equal(seedRefusalBadge(null), null);
  });

  // refused_at is the first refusal of that content, in the club's time.
  it("says when, in Istanbul, and that an operator's change is why", () => {
    const text = seedRefusalText(refusal(["published_by_operator"]));
    assert.equal(
      text?.headline,
      "23 Eyl 2026 00:10 tarihinde bir Template seed, bir operatör değişikliği yüzünden reddedildi; bu template'e hiçbir şey yazılmadı. Repodaki bir değişiklik karar bekliyor.",
    );
  });

  it("names each rule that held, in the order the API lists them", () => {
    const text = seedRefusalText(refusal(["published_by_operator", "newer_operator_version", "operator_subject"]));
    assert.deepEqual(text?.reasons, [
      "Gönderilen sürümü son Template seed değil, bir operatör yayımladı.",
      "Son Template seed'den sonra bir operatör yeni bir sürüm yazdı; yayımlanmamış bir taslak da sayılır.",
      "Gönderilen konuyu bir operatör değiştirdi; seed onun yerine repodaki konuyu yazacaktı.",
    ]);
  });

  it("says each rule on its own", () => {
    assert.equal(seedRuleText("published_by_operator"), "Gönderilen sürümü son Template seed değil, bir operatör yayımladı.");
    assert.equal(
      seedRuleText("newer_operator_version"),
      "Son Template seed'den sonra bir operatör yeni bir sürüm yazdı; yayımlanmamış bir taslak da sayılır.",
    );
    assert.equal(seedRuleText("operator_subject"), "Gönderilen konuyu bir operatör değiştirdi; seed onun yerine repodaki konuyu yazacaktı.");
  });

  // A rule a newer backend adds is still shown, not dropped or blanked.
  it("still shows a rule it has no words for", () => {
    assert.equal(seedRuleText("repo_theme_changed"), "Kural: repo_theme_changed.");
    assert.equal(seedRuleText("constructor"), "Kural: constructor.");
  });

  it("says what forcing the seed would do, and what not forcing leaves", () => {
    const text = seedRefusalText(refusal(["newer_operator_version"]));
    assert.equal(
      text?.forcing,
      "Zorlamak bir geliştiricinin işi. Seed bu template için zorlanırsa repodaki hâli hemen yayımlanır ve gönderilen mail değişir. Operatörlerin sürümleri silinmez: bu geçmişte kalır, karşılaştırılıp geri getirilebilir. Süren taslaklar bayatlar; yayımlanırken yeni sürümle yan yana gösterilir.",
    );
    assert.equal(
      text?.unforced,
      "Zorlanmazsa repodaki değişiklik bu template'e gelmez ve gönderilen mail olduğu gibi kalır. Repo, gönderilen içeriği aynen tutarsa sonraki seed çakışmadan geçer.",
    );
  });

  it("is short enough to stand in the template's header", () => {
    assert.equal(seedRefusalBadge(refusal(["operator_subject"])), "Template seed reddedildi · 23 Eyl 2026 00:10");
  });

  it("says a refusal with no valid time without losing it", () => {
    const text = seedRefusalText({ ...refusal(["operator_subject"]), refused_at: "" });
    assert.match(text?.headline ?? "", /^Bir Template seed, bir operatör değişikliği yüzünden reddedildi;/);
    assert.equal(seedRefusalBadge({ ...refusal([]), refused_at: "yok" }), "Template seed reddedildi");
  });
});
