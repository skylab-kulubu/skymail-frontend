import type { ApiClient } from "./api/client";
import { ApiError } from "./api/errors";
import type { SendAudience } from "./sends";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Immutable source as the compose and historical audience card need it. */
export type FormSource = Readonly<{
  id: string;
  form_id: string;
  form_title: string;
  recipient_count: number;
  prepared_at: string;
}>;

export type PreparedFormSource = FormSource & Readonly<{
  owner_sub: string;
  response_count: number;
  skipped_count: number;
  duplicate_count: number;
  expires_at: string;
}>;

/** A message only names a candidate; this owner-bound API response is the authority. */
export async function fetchFormSource(api: ApiClient, id: string, formId: string, subject: string, signal?: AbortSignal, now = Date.now()): Promise<PreparedFormSource> {
  if (!UUID.test(id) || !UUID.test(formId)) throw new ApiError(404, "server.not_found");
  const source = await api.get<PreparedFormSource>(`/form_mail_sources/${id}`, { signal });
  if (!source || typeof source !== "object") throw new ApiError(409, "form_source.changed");
  const counts = [source.recipient_count, source.response_count, source.skipped_count, source.duplicate_count];
  const prepared = Date.parse(source.prepared_at);
  const expires = Date.parse(source.expires_at);
  if (source.id !== id || source.form_id !== formId || source.owner_sub !== subject
      || typeof source.form_title !== "string" || source.form_title.length > 100
      || typeof source.prepared_at !== "string" || typeof source.expires_at !== "string"
      || counts.some((count) => !Number.isSafeInteger(count) || count < 0) || source.recipient_count === 0
      || source.response_count !== source.recipient_count + source.skipped_count + source.duplicate_count
      || !Number.isFinite(prepared) || !Number.isFinite(expires) || prepared >= expires || expires <= now) {
    throw new ApiError(409, "form_source.changed");
  }
  return source;
}

/** Historical readback never reopens or consumes a prepared source. */
export function audienceFormSource(audience: SendAudience): FormSource | null {
  if (audience.kind !== "form" || audience.source !== "forms" || !audience.form_source_id || !audience.form_id
      || !UUID.test(audience.form_source_id) || !UUID.test(audience.form_id)
      || !Number.isSafeInteger(audience.recipient_count) || (audience.recipient_count ?? 0) < 1
      || !audience.prepared_at || !Number.isFinite(Date.parse(audience.prepared_at))) return null;
  return { id: audience.form_source_id, form_id: audience.form_id, form_title: audience.name ?? "Forms formu", recipient_count: audience.recipient_count!, prepared_at: audience.prepared_at };
}

/** Only the configured club console origin; no URL supplied by a handoff or API. */
export function formResponsesHref(consoleUrl: string, formId: string): string | null {
  if (!UUID.test(formId)) return null;
  try {
    const console = new URL(consoleUrl);
    if (!["https:", "http:"].includes(console.protocol)) return null;
    return new URL(`/admin/forms/${formId}/responses`, console.origin).href;
  } catch { return null; }
}
