import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiErrorFromResponse } from "./api/errors";
import { TEST_BASE_URL, json, scriptedClient } from "./api/testing";
import {
  REASON_LABEL,
  bounceSummaryParts,
  exemptNote,
  fetchBounceSummary,
  fetchReactivationPage,
  fetchSuppressionPage,
  reactivate,
  reactivateRefusal,
  reactivatedBy,
  reasonProblem,
  readerLine,
  removeRefusal,
  removeSuppression,
  sourceLabel,
} from "./suppressions";

describe("the suppression list", () => {
  it("asks for one reason, or both, a page at a time", async () => {
    const { api, calls } = scriptedClient(json(200, [], { "X-Total-Count": "0" }), json(200, [], { "X-Total-Count": "0" }));
    await fetchSuppressionPage(api, { reason: "unsubscribed", page: 2 });
    await fetchSuppressionPage(api, { reason: "all", page: 1 });
    assert.equal(calls[0].url, `${TEST_BASE_URL}/suppressions?reason=unsubscribed&_start=50&_end=100`);
    assert.equal(calls[1].url, `${TEST_BASE_URL}/suppressions?_start=0&_end=50`);
  });

  it("searches by part of an address, trimmed, and leaves an empty search out", async () => {
    const { api, calls } = scriptedClient(json(200, [], { "X-Total-Count": "0" }), json(200, [], { "X-Total-Count": "0" }));
    await fetchSuppressionPage(api, { reason: "bounce", page: 1, q: "  ali@ " });
    await fetchSuppressionPage(api, { reason: "bounce", page: 1, q: "   " });
    assert.equal(calls[0].url, `${TEST_BASE_URL}/suppressions?reason=bounce&q=ali%40&_start=0&_end=50`);
    assert.equal(calls[1].url, `${TEST_BASE_URL}/suppressions?reason=bounce&_start=0&_end=50`);
  });

  it("says where a row came from with its codes, never a text", () => {
    assert.equal(sourceLabel({ source: "dsn", reason_code: "5.1.10" }), "Teslim raporu · 5.1.10");
    assert.equal(sourceLabel({ source: "smtp", reason_code: "RCPT TO 550 5.1.1" }), "Gönderimde ret · RCPT TO 550 5.1.1");
    assert.equal(sourceLabel({ source: "dsn", reason_code: "" }), "Teslim raporu");
    assert.equal(sourceLabel({ source: "link", reason_code: null }), "Çıkış bağlantısı");
  });

  it("flags a bounce that account mail still went to", () => {
    assert.equal(exemptNote({ exempt_flagged_at: null }), null);
    assert.equal(exemptNote({}), null);
    assert.match(exemptNote({ exempt_flagged_at: "2026-10-26T09:30:00Z" }) ?? "", /^Hesap postası gitti · /);
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
    assert.equal(reasonProblem("  Kişi bilgi kutusuna yazıp istedi.\n"), null);
    assert.equal(reasonProblem("Kişi bilgi kutusuna\nyazıp istedi."), "Gerekçe tek satır olmalı.");
    assert.equal(reasonProblem("Kişi bilgi kutusuna\tyazıp istedi."), "Gerekçe tek satır olmalı.");
    assert.equal(reasonProblem("Kişi bilgi kutusuna\u00a0yazıp istedi."), "Gerekçede görünmeyen bir karakter var.");
    assert.equal(reasonProblem("Kişi bilgi kutusuna\u200byazıp istedi."), "Gerekçede görünmeyen bir karakter var.");
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
    assert.deepEqual(refusal(400, "suppression.reason_required"), { text: "Gerekçe tek satır ve 10–500 karakter olmalı.", reload: false });
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

describe("removing a bounce", () => {
  it("deletes the row by its id, never by the address", async () => {
    const { api, calls } = scriptedClient(new Response(null, { status: 204 }));
    await removeSuppression(api, "a1/b");
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, `${TEST_BASE_URL}/suppressions/a1%2Fb`);
  });

  it("says the backend's 403, 404 and 409 in words", () => {
    const refusal = (status: number, code: string) => removeRefusal(apiErrorFromResponse(status, JSON.stringify({ code })));
    assert.deepEqual(refusal(403, "server.forbidden"), { text: "Kaldırma yetkin yok (skymail:suppressions:manage).", reload: false });
    assert.deepEqual(refusal(404, "server.not_found"), { text: "Kayıt artık listede yok.", reload: true });
    assert.deepEqual(refusal(409, "suppression.use_reactivate"), { text: "Bu kayıt abonelikten çıkış; kaldırılmaz, geri alınır.", reload: true });
  });
});

describe("the bounce rate", () => {
  const summary = {
    days: 30,
    sent: 1200,
    hard: 6,
    soft: 2,
    delay: 1,
    hard_rate: 0.005,
    reader: [],
  };

  it("asks for the window it shows", async () => {
    const { api, calls } = scriptedClient(json(200, summary));
    const got = await fetchBounceSummary(api, 30);
    assert.equal(calls[0].url, `${TEST_BASE_URL}/suppressions/bounces?days=30`);
    assert.equal(got.hard, 6);
  });

  it("says the window's mail in short parts, leaving out what did not happen", () => {
    assert.deepEqual(bounceSummaryParts(summary), ["1.200 gönderildi", "6 ulaşmadı (%0,5)", "2 yumuşak ret", "1 gecikme"]);
    assert.deepEqual(bounceSummaryParts({ ...summary, sent: 0, hard: 0, soft: 0, delay: 0, hard_rate: 0 }), ["Gönderim yok"]);
  });

  it("says each sender mailbox's last read, and its error", () => {
    const state = {
      mailbox: "hesap@bildirim.yildizskylab.com",
      mode: "on" as const,
      last_polled_at: null,
      last_error: null,
    };
    assert.equal(readerLine(state), "hesap@bildirim.yildizskylab.com · açık · henüz yoklanmadı");
    assert.equal(readerLine({ ...state, mode: "dry-run" }), "hesap@bildirim.yildizskylab.com · deneme · henüz yoklanmadı");
    const read = readerLine({ ...state, last_polled_at: "2026-10-27T10:00:00Z", last_error: "graph: 403 ErrorAccessDenied" });
    assert.match(read, /^hesap@bildirim\.yildizskylab\.com · açık · son yoklama .+ · hata: graph: 403 ErrorAccessDenied$/);
  });
});
