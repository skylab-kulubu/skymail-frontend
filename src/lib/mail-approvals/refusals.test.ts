/**
 * What an approval action that failed says (ticket 20), for every refusal
 * the API names (ticket 19): in plain Turkish, with what to do next, and
 * whether the request is read again — a refusal that means it changed under
 * the viewer (busy, changed, expired, another state, a template published
 * again) is followed by the request as it is now.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../api/errors";
import { approvalRefusal } from "./refusals";

const refusal = (status: number, code: string, params?: Record<string, unknown>) => new ApiError(status, code, "english", params);

describe("a refused approval action", () => {
  it("explains a template published again since the request, to the approver and to the submitter", () => {
    assert.deepEqual(approvalRefusal(refusal(409, "mail_approval.template_republished"), "approve"), {
      text: "Bu istek sunulduktan sonra Mail template'in yeni bir sürümü yayımlandı; onaylanırsa sunulan mail gitmez. İsteği gerekçesiyle reddet; sunan yeni sürümle yeniden sunabilir.",
      reload: true,
    });
    assert.deepEqual(approvalRefusal(refusal(409, "mail_approval.template_republished"), "accept"), {
      text: "Bu istek sunulduktan sonra Mail template'in yeni bir sürümü yayımlandı; düzenleme kabul edilirse sunulan mail gitmez. Kabul etme; isteği yeni sürümle yeniden sunabilirsin.",
      reload: true,
    });
  });

  it("reads the request again when someone else is acting on it, or it changed", () => {
    assert.deepEqual(approvalRefusal(refusal(409, "mail_approval.busy"), "reject"), {
      text: "Şu anda başka biri bu istek üzerinde işlem yapıyor. İstek yeniden yüklendi; son hâline bakıp tekrar dene.",
      reload: true,
    });
    assert.deepEqual(approvalRefusal(refusal(409, "mail_approval.changed"), "approve"), {
      text: "İstek bu işlem hazırlanırken değişti. İstek yeniden yüklendi; son hâline bakıp tekrar dene.",
      reload: true,
    });
  });

  it("says an expired request is final, and what state a request moved to", () => {
    assert.deepEqual(approvalRefusal(refusal(409, "mail_approval.expired", { deadline_at: "2026-09-30T09:00:00Z" }), "approve"), {
      text: "İstek 7 gün içinde karara bağlanmadığı için süresi doldu; artık gönderilmez.",
      reload: true,
    });
    assert.deepEqual(approvalRefusal(refusal(409, "mail_approval.state_conflict", { state: "approved", allowed: ["pending"] }), "reject"), {
      text: "Bu istek artık “Onaylandı” durumunda; bu işlem yapılamaz.",
      reload: true,
    });
  });

  it("names the missing role, or who alone may do it", () => {
    assert.equal(approvalRefusal(refusal(403, "server.forbidden"), "approve").text, "Bu işlem için skymail:mails:approve rolü gerekiyor.");
    assert.equal(approvalRefusal(refusal(403, "mail_approval.not_submitter"), "accept").text, "Bu işlemi yalnız isteği sunan yapabilir.");
    assert.equal(approvalRefusal(refusal(404, "server.not_found"), "approve").text, "İstek bulunamadı: yok ya da görme yetkin yok.");
  });

  it("says what is wrong with an edit or a submission", () => {
    assert.equal(
      approvalRefusal(refusal(422, "mail_approval.no_edit"), "return").text,
      "Düzenleme sunulan değerlerle aynı; sunana geri göndermek için en az bir değişkeni değiştir.",
    );
    assert.equal(
      approvalRefusal(
        refusal(422, "mail_approval.required_variables_missing", {
          missing: [
            { name: "EventName", source: "operator", reason: null },
            { name: "ResetUrl", source: "contract", reason: "sıfırlama bağlantısı" },
          ],
        }),
        "approveEdited",
      ).text,
      "Required variable boş bırakılamaz: EventName, ResetUrl (sıfırlama bağlantısı).",
    );
    assert.equal(
      approvalRefusal(refusal(422, "mail_approval.unrenderable", { error: "template: x:1: unexpected EOF" }), "submit").text,
      "Mail template bu değerlerle işlenemiyor: template: x:1: unexpected EOF",
    );
    assert.equal(
      approvalRefusal(refusal(422, "mail_approval.template_unavailable"), "submit").text,
      "Mail template arşivlenmiş ya da yayımlanmış bir sürümü yok; gönderilemez.",
    );
    assert.equal(
      approvalRefusal(refusal(409, "mail_approval.audience_unavailable"), "approve").text,
      "Mail listesi arşivlenmiş ya da Keycloak grubu artık yok; gönderilemez.",
    );
    assert.equal(approvalRefusal(refusal(409, "mail_approval.audience_empty"), "accept").text, "Mail listesinde gönderilecek kimse yok; gönderilemez.");
    assert.equal(approvalRefusal(refusal(400, "validation.error"), "reject").text, "Ret gerekçesi boş olamaz.");
  });

  // Approving without an edit is idempotent on the server: approving again
  // sends nothing a second time.
  it("says a send may have opened when no answer came, and reads the request again", () => {
    assert.deepEqual(approvalRefusal(new ApiError(0, "network"), "approve"), {
      text: "Sunucudan yanıt gelmedi. Onay alınmış ve gönderim açılmış olabilir; istek yeniden yüklendi, durumuna bak. Yeniden onaylamak ikinci bir gönderim açmaz.",
      reload: true,
    });
    assert.deepEqual(approvalRefusal(refusal(500, "server.internal_server_error"), "reject"), {
      text: "Sunucu bir hatayla yanıt verdi (HTTP 500). İşlem yapılmış olabilir; istek yeniden yüklendi, durumuna bak.",
      reload: true,
    });
    assert.deepEqual(approvalRefusal(refusal(502, "server.service_unavailable"), "submit"), {
      text: "Sunucu bir hatayla yanıt verdi (HTTP 502). İstek açılmış olabilir; yeniden sunmadan önce Mail onayları listesine bak.",
      reload: false,
    });
  });

  it("falls back on the API's Turkish sentence for anything else", () => {
    assert.deepEqual(approvalRefusal(refusal(401, "session.ended"), "approve"), {
      text: "Oturumun sona erdi. Devam etmek için yeniden giriş yap.",
      reload: false,
    });
  });
});
