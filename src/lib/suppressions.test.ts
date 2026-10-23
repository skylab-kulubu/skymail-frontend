import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiErrorFromResponse } from "./api/errors";
import { TEST_BASE_URL, json, scriptedClient } from "./api/testing";
import {
  REASON_LABEL,
  fetchReactivationPage,
  fetchSuppressionPage,
  reactivate,
  reactivateRefusal,
  reactivatedBy,
  reasonProblem,
} from "./suppressions";

describe("the suppression list", () => {
  it("asks for one reason, or both, a page at a time", async () => {
    const { api, calls } = scriptedClient(json(200, [], { "X-Total-Count": "0" }), json(200, [], { "X-Total-Count": "0" }));
    await fetchSuppressionPage(api, { reason: "unsubscribed", page: 2 });
    await fetchSuppressionPage(api, { reason: "all", page: 1 });
    assert.equal(calls[0].url, `${TEST_BASE_URL}/suppressions?reason=unsubscribed&_start=50&_end=100`);
    assert.equal(calls[1].url, `${TEST_BASE_URL}/suppressions?_start=0&_end=50`);
  });

  it("says each row's reason with the stream it holds back", () => {
    assert.equal(REASON_LABEL.bounce, "Kalıcı ret · tüm postalar");
    assert.equal(REASON_LABEL.unsubscribed, "Abonelikten çıktı · duyurular");
  });
});

describe("reversing an unsubscribe", () => {
  it("does not go without a reason of 10 to 500 characters that names no address", () => {
    assert.equal(reasonProblem(""), "Gerekçe 10–500 karakter olmalı.");
    assert.equal(reasonProblem("   kısa    "), "Gerekçe 10–500 karakter olmalı.");
    assert.equal(reasonProblem("ş".repeat(501)), "Gerekçe 10–500 karakter olmalı.");
    assert.equal(reasonProblem("Kişi ayse@example.com adresinden yazdı"), "Gerekçeye adres yazma.");
    assert.equal(reasonProblem("Kişi bilgi kutusuna yazıp istedi."), null);
  });

  it("sends the reason trimmed, the row named by its id", async () => {
    const { api, calls } = scriptedClient(new Response(null, { status: 204 }));
    await reactivate(api, "a1/b", "  Kişi yeniden abone olmak istedi.  ");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${TEST_BASE_URL}/suppressions/a1%2Fb/reactivate`);
    assert.deepEqual(JSON.parse(calls[0].body ?? ""), { reason: "Kişi yeniden abone olmak istedi." });
  });

  it("says the backend's 400, 403 and 409 in words", () => {
    const refusal = (status: number, code: string) => reactivateRefusal(apiErrorFromResponse(status, JSON.stringify({ code })));
    assert.deepEqual(refusal(400, "suppression.reason_required"), { text: "Gerekçe 10–500 karakter olmalı.", reload: false });
    assert.deepEqual(refusal(400, "suppression.reason_has_address"), { text: "Gerekçeye adres yazma.", reload: false });
    assert.deepEqual(refusal(403, "server.forbidden"), { text: "Geri alma yetkin yok (skymail:unsubscribes:reactivate).", reload: false });
    assert.deepEqual(refusal(409, "suppression.use_delete"), { text: "Bu kayıt kalıcı ret; geri alınmaz, kaldırılır.", reload: true });
    assert.equal(refusal(404, "server.not_found").reload, true);
  });

  it("lists who reversed one, without an address", async () => {
    const row = {
      id: 1,
      actor: "operator",
      actor_sub: "5b0c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d",
      reason: "Kişi istedi, kayıt hatalıydı.",
      stream: "duyuru",
      source: "link",
      unsubscribed_at: "2026-10-20T10:00:00Z",
      reactivated_at: "2026-10-22T10:00:00Z",
    };
    const { api, calls } = scriptedClient(json(200, [row], { "X-Total-Count": "1" }));
    const page = await fetchReactivationPage(api, 1);
    assert.equal(calls[0].url, `${TEST_BASE_URL}/suppressions/reactivations?_start=0&_end=50`);
    assert.equal(page.total, 1);
    assert.ok(!JSON.stringify(page.rows).includes("@"));
    assert.equal(reactivatedBy({ actor: "recipient", actor_sub: null }), "Kişinin kendisi");
    assert.equal(reactivatedBy({ actor: "operator", actor_sub: "00000000-0000-4000-8000-000000000000" }), "Silinmiş kullanıcı");
  });
});
