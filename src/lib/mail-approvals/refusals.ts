/**
 * What an approval action that failed says (ticket 20), for each refusal the
 * API names (ticket 19, `mail_approval.*`): in plain Turkish, with what to do
 * next, and whether the page reads the request again. A refusal meaning the
 * request moved under the viewer — someone else acting on it, a change, an
 * expiry, another state, a template published again — is followed by the
 * request as it is now; so is an answer that never came, since the action
 * may have gone through.
 */
import { asApiError, type ApiError } from "../api/errors";
import { APPROVAL_STATE_LABEL, type ApprovalState } from "./approvals";

export type ApprovalActionName =
  | "submit"
  | "resubmit"
  | "approve"
  | "approveEdited"
  | "return"
  | "reject"
  | "accept"
  | "decline";

export type ApprovalRefusal = Readonly<{ text: string; reload: boolean }>;

const APPROVER_ACTIONS: readonly ApprovalActionName[] = ["approve", "approveEdited", "return", "reject"];
const SUBMISSIONS: readonly ApprovalActionName[] = ["submit", "resubmit"];

function missingVariables(error: ApiError): string {
  const missing = error.params?.missing;
  if (!Array.isArray(missing)) return "";
  return missing
    .filter((entry): entry is { name: string; reason?: unknown } => typeof entry?.name === "string")
    .map((entry) => (typeof entry.reason === "string" && entry.reason.trim() ? `${entry.name} (${entry.reason.trim()})` : entry.name))
    .join(", ");
}

function stateLabel(error: ApiError): string | null {
  const state = error.params?.state;
  return typeof state === "string" && Object.hasOwn(APPROVAL_STATE_LABEL, state) ? APPROVAL_STATE_LABEL[state as ApprovalState] : null;
}

/** An answer that never came, or a server error: the action may have gone through. */
function unanswered(error: ApiError, action: ApprovalActionName): ApprovalRefusal {
  const cause = error.status === 0 ? "Sunucudan yanıt gelmedi." : `Sunucu bir hatayla yanıt verdi (HTTP ${error.status}).`;
  if (SUBMISSIONS.includes(action)) {
    return { text: `${cause} İstek açılmış olabilir; yeniden sunmadan önce Mail onayları listesine bak.`, reload: false };
  }
  if (action === "approve") {
    return {
      text: `${cause} Onay alınmış ve gönderim açılmış olabilir; istek yeniden yüklendi, durumuna bak. Yeniden onaylamak ikinci bir gönderim açmaz.`,
      reload: true,
    };
  }
  if (action === "approveEdited" || action === "accept") {
    return { text: `${cause} Gönderim açılmış olabilir; istek yeniden yüklendi, durumuna bak.`, reload: true };
  }
  return { text: `${cause} İşlem yapılmış olabilir; istek yeniden yüklendi, durumuna bak.`, reload: true };
}

export function approvalRefusal(thrown: unknown, action: ApprovalActionName): ApprovalRefusal {
  const error = asApiError(thrown);
  const again = (text: string): ApprovalRefusal => ({ text, reload: true });
  const say = (text: string): ApprovalRefusal => ({ text, reload: false });

  switch (error.code) {
    case "mail_approval.template_republished":
      return again(
        action === "accept"
          ? "Bu istek sunulduktan sonra Mail template'in yeni bir sürümü yayımlandı; düzenleme kabul edilirse sunulan mail gitmez. Kabul etme; isteği yeni sürümle yeniden sunabilirsin."
          : "Bu istek sunulduktan sonra Mail template'in yeni bir sürümü yayımlandı; onaylanırsa sunulan mail gitmez. İsteği gerekçesiyle reddet; sunan yeni sürümle yeniden sunabilir.",
      );
    case "mail_approval.busy":
      return again("Şu anda başka biri bu istek üzerinde işlem yapıyor. İstek yeniden yüklendi; son hâline bakıp tekrar dene.");
    case "mail_approval.changed":
      return again("İstek bu işlem hazırlanırken değişti. İstek yeniden yüklendi; son hâline bakıp tekrar dene.");
    case "mail_approval.expired":
      return again("İstek 7 gün içinde karara bağlanmadığı için süresi doldu; artık gönderilmez.");
    case "mail_approval.state_conflict": {
      const label = stateLabel(error);
      return again(label ? `Bu istek artık “${label}” durumunda; bu işlem yapılamaz.` : "Bu istek artık bu işlemin yapılabileceği durumda değil.");
    }
    case "mail_approval.not_submitter":
      return say("Bu işlemi yalnız isteği sunan yapabilir.");
    case "mail_approval.no_edit":
      return say("Düzenleme sunulan değerlerle aynı; sunana geri göndermek için en az bir değişkeni değiştir.");
    case "mail_approval.required_variables_missing": {
      const names = missingVariables(error);
      return say(names ? `Required variable boş bırakılamaz: ${names}.` : "Mail template'in Required variable'larından biri boş.");
    }
    case "mail_approval.unrenderable": {
      const detail = typeof error.params?.error === "string" ? error.params.error : "";
      return say(detail ? `Mail template bu değerlerle işlenemiyor: ${detail}` : "Mail template bu değerlerle işlenemiyor.");
    }
    case "mail_approval.template_unavailable":
      return say("Mail template arşivlenmiş ya da yayımlanmış bir sürümü yok; gönderilemez.");
    case "mail_approval.audience_unavailable":
      return say("Mail listesi arşivlenmiş ya da Keycloak grubu artık yok; gönderilemez.");
    case "mail_approval.audience_empty":
      return say("Mail listesinde gönderilecek kimse yok; gönderilemez.");
  }
  if (error.status === 0 || error.status >= 500) return unanswered(error, action);
  if (error.status === 403) {
    return say(APPROVER_ACTIONS.includes(action) ? "Bu işlem için skymail:mails:approve rolü gerekiyor." : error.message);
  }
  if (error.status === 404) return say("İstek bulunamadı: yok ya da görme yetkin yok.");
  if (error.code === "validation.error" && action === "reject") return say("Ret gerekçesi boş olamaz.");
  return say(error.message);
}
