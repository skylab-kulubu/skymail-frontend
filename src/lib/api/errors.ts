/**
 * What an operator reads when a request to the SkyMail API fails.
 *
 * The API answers an error with `{ code, message, params? }` (skymail-backend
 * `internal/apperrors`). The `message` is English and written for developers,
 * so the panel shows a Turkish sentence chosen by `code`, falling back to one
 * chosen by the HTTP status for codes it does not know yet. The server's own
 * message stays on the error for logs and support.
 */

const SESSION_ENDED = "Oturumun sona erdi. Devam etmek için yeniden giriş yap.";

const BY_CODE: Readonly<Record<string, string>> = {
  /** Raised by the client itself when the session could not be refreshed. */
  "session.ended": SESSION_ENDED,
  "server.unauthorized": SESSION_ENDED,
  "server.forbidden": "Bu işlem için yetkin yok.",
  "server.not_found": "Aradığın kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir.",
  "server.method_not_allowed": "Bu işlem desteklenmiyor.",
  "server.too_many_requests": "Kısa sürede çok fazla istek gönderildi. Biraz bekleyip tekrar dene.",
  "server.service_unavailable": "SkyMail şu anda yanıt vermiyor. Biraz sonra tekrar dene.",
  "server.internal_server_error":
    "Sunucuda beklenmeyen bir hata oluştu. Tekrar dene; sürerse yöneticine haber ver.",
  "server.unknown_error":
    "Sunucuda beklenmeyen bir hata oluştu. Tekrar dene; sürerse yöneticine haber ver.",
  "server.conflict": "Bu kayıt mevcut bir kayıtla çakışıyor.",
  "validation.error": "Gönderilen bilgiler geçersiz. Alanları kontrol edip tekrar dene.",
  "template.system_protected":
    "System template arşivlenemez: başka bir servis bu maili Template key ile gönderiyor.",
  "template.system_key_immutable": "Bir System template'in Template key'i değiştirilemez.",
  "mail.template_target_missing": "Gönderim için bir Mail template seçmelisin.",
  /** Raised by the client itself when a success carried something other than JSON. */
  "response.not_json": "Sunucudan beklenmeyen bir yanıt geldi. Sayfayı yenileyip tekrar dene.",
};

function byStatus(status: number): string {
  if (status === 0) return "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.";
  if (status === 400 || status === 422) return BY_CODE["validation.error"];
  if (status === 401) return BY_CODE["server.unauthorized"];
  if (status === 403) return BY_CODE["server.forbidden"];
  if (status === 404) return BY_CODE["server.not_found"];
  if (status === 409) return BY_CODE["server.conflict"];
  if (status === 429) return BY_CODE["server.too_many_requests"];
  if (status === 502 || status === 503 || status === 504) {
    return "Sunucu şu anda yanıt vermiyor. Biraz sonra tekrar dene.";
  }
  if (status >= 500) return BY_CODE["server.internal_server_error"];
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
    super(BY_CODE[code] ?? byStatus(status));
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
