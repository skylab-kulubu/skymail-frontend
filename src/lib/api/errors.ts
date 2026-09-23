/**
 * What an operator reads when a request to the SkyMail API fails.
 *
 * The API answers an error with `{ code, message, params? }` (skymail-backend
 * `internal/apperrors`). The `message` is English and written for developers,
 * so the panel shows a Turkish sentence chosen by `code`, falling back to one
 * chosen by the HTTP status for codes it does not know yet. The server's own
 * message stays on the error for logs and support.
 *
 * The codes below are every one skymail-backend `origin/main` raises
 * (2026-09-23); a new code the backend adds falls back to its status until it
 * gets a sentence here.
 */

const TEXT = {
  sessionEnded: "Oturumun sona erdi. Devam etmek için yeniden giriş yap.",
  forbidden: "Bu işlem için yetkin yok.",
  notFound: "Aradığın kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir.",
  invalid: "Gönderilen bilgiler geçersiz. Alanları kontrol edip tekrar dene.",
  conflict: "Bu kayıt mevcut bir kayıtla çakışıyor.",
  tooMany: "Kısa sürede çok fazla istek gönderildi. Biraz bekleyip tekrar dene.",
  unavailable: "SkyMail şu anda yanıt vermiyor. Biraz sonra tekrar dene.",
  serverError: "Sunucuda beklenmeyen bir hata oluştu. Tekrar dene; sürerse yöneticine haber ver.",
  unreachable: "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.",
} as const;

// A Map, not an object literal: a code is untrusted input, and "constructor"
// or "toString" must not find what every object inherits.
const BY_CODE: ReadonlyMap<string, string> = new Map([
  // Raised by the client itself: no session, or one that could not be refreshed.
  ["session.ended", TEXT.sessionEnded],
  // Raised by the client itself: a success that carried something other than JSON.
  ["response.not_json", "Sunucudan beklenmeyen bir yanıt geldi. Sayfayı yenileyip tekrar dene."],

  ["server.unauthorized", TEXT.sessionEnded],
  ["server.forbidden", TEXT.forbidden],
  ["server.not_found", TEXT.notFound],
  ["server.method_not_allowed", "Bu işlem desteklenmiyor."],
  ["server.too_many_requests", TEXT.tooMany],
  ["server.service_unavailable", TEXT.unavailable],
  ["server.internal_server_error", TEXT.serverError],
  ["server.unknown_error", TEXT.serverError],
  ["server.conflict", TEXT.conflict],
  ["validation.error", TEXT.invalid],
  [
    "template.system_protected",
    "System template arşivlenemez: başka bir servis bu maili Template key ile gönderiyor.",
  ],
  ["template.system_key_immutable", "Bir System template'in Template key'i değiştirilemez."],
  [
    "template.invalid_key",
    "Template key geçersiz: 3–64 karakter olmalı; küçük harf, rakam, nokta ve tire içerebilir, harf ya da rakamla başlayıp bitmeli.",
  ],
  ["mail.template_target_missing", "Gönderim için bir Mail template seçmelisin."],
  // Drafts and publishing (ticket 07) and Required variables (ticket 08); the
  // editor spells out the details of the last two from their params.
  [
    "template.stale_base",
    "Bu taslağı başlattıktan sonra başka bir sürüm yayımlandı. İki sürümü karşılaştırıp seç.",
  ],
  ["template.not_a_draft", "Bu sürüm taslak değil, yayımlanmış. Yeniden yayımlamak için geri getirip taslak olarak yayımla."],
  ["template.draft_discarded", "Bu taslak atılmış; yayımlanamaz. Geçmişten geri getirip yeni bir taslak olarak kullanabilirsin."],
  ["template.invalid_base", "Taslağın başladığı sürüm geçerli değil. Sayfayı yenileyip tekrar dene."],
  ["template.main_source_missing", "Main source seçilen Authoring mode'da kaynak yok."],
  ["template.unparseable", "Konu ya da gövde, mailer'ın okuyabileceği bir Go template değil."],
  [
    "template.required_variables_missing",
    "Gövde, bu template'in Required variable'larından bazılarına artık başvurmuyor.",
  ],
  // Marking and releasing a Required variable (ticket 13).
  ["template.required_variable_in_contract", "Bu değişken gönderen servisin sözleşmesinde; panelden çıkarılamaz."],
  // Mail onayı (ticket 19); the approval screens say more from the params
  // and the action (src/lib/mail-approvals/refusals.ts).
  ["mail_approval.template_unavailable", "Mail template arşivlenmiş ya da yayımlanmış bir sürümü yok; gönderilemez."],
  ["mail_approval.audience_unavailable", "Mail listesi arşivlenmiş ya da Keycloak grubu artık yok; gönderilemez."],
  ["mail_approval.audience_empty", "Mail listesinde gönderilecek kimse yok; gönderilemez."],
  ["mail_approval.required_variables_missing", "Mail template'in Required variable'larından biri boş."],
  ["mail_approval.unrenderable", "Mail template bu değerlerle işlenemiyor."],
  ["mail_approval.busy", "Şu anda başka biri bu istek üzerinde işlem yapıyor. Yeniden yükleyip tekrar dene."],
  ["mail_approval.changed", "İstek bu işlem hazırlanırken değişti. Yeniden yükleyip tekrar dene."],
  ["mail_approval.expired", "İstek 7 gün içinde karara bağlanmadığı için süresi doldu; artık gönderilmez."],
  ["mail_approval.state_conflict", "Bu istek artık bu işlemin yapılabileceği durumda değil."],
  [
    "mail_approval.template_republished",
    "Bu istek sunulduktan sonra Mail template'in yeni bir sürümü yayımlandı; sunulan mail gönderilemez.",
  ],
  ["mail_approval.not_submitter", "Bu işlemi yalnız isteği sunan yapabilir."],
  ["mail_approval.no_edit", "Düzenleme sunulan değerlerle aynı."],
  [
    "template.invalid_variable_name",
    "Değişken adı geçersiz: harf ya da alt çizgiyle başlamalı; yalnız İngilizce harf, rakam ve alt çizgi içerebilir, en çok 64 karakter.",
  ],
]);

function byStatus(status: number): string {
  if (status === 0) return TEXT.unreachable;
  if (status === 400 || status === 422) return TEXT.invalid;
  if (status === 401) return TEXT.sessionEnded;
  if (status === 403) return TEXT.forbidden;
  if (status === 404) return TEXT.notFound;
  if (status === 409) return TEXT.conflict;
  if (status === 429) return TEXT.tooMany;
  if (status === 502 || status === 503 || status === 504) return TEXT.unavailable;
  if (status >= 500) return TEXT.serverError;
  return `İstek tamamlanamadı (HTTP ${status}).`;
}

export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    /** HTTP status, or 0 when no answer arrived. */
    readonly status: number,
    /** The API's error code, or `http.<status>` / `network` when it sent none. */
    readonly code: string,
    /** The API's own (English) message, kept for logs and support. */
    readonly serverMessage?: string,
    readonly params?: Readonly<Record<string, unknown>>,
  ) {
    super(BY_CODE.get(code) ?? byStatus(status));
  }
}

type ErrorBody = { code?: unknown; message?: unknown; params?: unknown };

function readErrorBody(text: string): ErrorBody {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" ? (parsed as ErrorBody) : {};
  } catch {
    return {};
  }
}

/** Builds the error for a non-2xx answer from its status and raw body text. */
export function apiErrorFromResponse(status: number, text: string): ApiError {
  const body = readErrorBody(text);
  const code = typeof body.code === "string" && body.code !== "" ? body.code : `http.${status}`;
  const serverMessage = typeof body.message === "string" ? body.message : undefined;
  const params =
    body.params !== null && typeof body.params === "object"
      ? (body.params as Record<string, unknown>)
      : undefined;
  return new ApiError(status, code, serverMessage, params);
}

export function networkError(cause: unknown): ApiError {
  const error = new ApiError(0, "network");
  (error as { cause?: unknown }).cause = cause;
  return error;
}

/**
 * Whatever a failed request threw, as the ApiError the panel shows. Anything
 * that is not one — a TypeError from fetch, a bug in the page — reads like a
 * request that never reached the server.
 */
export function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : networkError(error);
}

/** The Turkish sentence for a failed action, whatever it threw. */
export function apiErrorMessage(error: unknown): string {
  return asApiError(error).message;
}
