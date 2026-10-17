import { isPlausibleEmail } from "./mailing-lists";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LIFETIME = 5 * 60 * 1000;

export type FormsHandoff = Readonly<{ nonce: string; formId: string; expires: number }>;
export type FormsRecipients = FormsHandoff & Readonly<{
  type: "skyforms:mail:recipients";
  preparedByUserId: string;
  formTitle: string;
  recipients: { name: string; email: string }[];
  responseCount: number;
  skippedCount: number;
  duplicateCount: number;
}>;
export type FormsSourceHandoff = FormsHandoff & Readonly<{
  type: "skyforms:mail:source";
  sourceId: string;
  preparedByUserId: string;
}>;

/** No addresses or browser-supplied metadata become a trusted source. */
export function formsSourceHandoff(value: unknown, binding: FormsHandoff, subject: string, now = Date.now()): FormsSourceHandoff | null {
  if (!formsHandoffMatches(value, binding, now) || value.type !== "skyforms:mail:source"
      || value.preparedByUserId !== subject || typeof value.sourceId !== "string" || !UUID.test(value.sourceId)
      || "recipients" in value) return null;
  return value as FormsSourceHandoff;
}

/** Only the Forms button's NEW compose request, never an approval copy or list. */
export function parseFormsHandoff(params: URLSearchParams, now = Date.now()): FormsHandoff | null {
  if (["source", "forms_handoff", "form_id", "expires"].some((key) => params.getAll(key).length !== 1)
      || params.get("source") !== "forms" || params.has("from_approval") || params.has("mail_list_id")) return null;
  const nonce = params.get("forms_handoff")!;
  const formId = params.get("form_id")!;
  const rawExpires = params.get("expires")!;
  const expires = Number(rawExpires);
  if (!UUID.test(nonce) || !UUID.test(formId) || !/^\d+$/.test(rawExpires)
      || !Number.isSafeInteger(expires) || expires <= now || expires > now + LIFETIME) return null;
  return { nonce, formId, expires };
}

export function formsHandoffMatches(value: unknown, binding: FormsHandoff, now = Date.now()): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || now >= binding.expires) return false;
  const data = value as Record<string, unknown>;
  return data.nonce === binding.nonce && data.formId === binding.formId && data.expires === binding.expires;
}

/** Shape and same-account checks after the caller has checked origin and opener identity. */
export function formsRecipients(value: unknown, binding: FormsHandoff, subject: string, now = Date.now()): FormsRecipients | null {
  if (!formsHandoffMatches(value, binding, now) || value.type !== "skyforms:mail:recipients"
      || value.preparedByUserId !== subject || typeof value.formTitle !== "string"
      || !Array.isArray(value.recipients) || value.recipients.length === 0) return null;
  const people = value.recipients;
  if (people.some((person: unknown) => {
    if (!person || typeof person !== "object") return true;
    const row = person as Record<string, unknown>;
    return typeof row.name !== "string" || typeof row.email !== "string" || row.email.length > 254
      || row.email !== row.email.trim() || !isPlausibleEmail(row.email);
  })) return null;
  const counts = [value.responseCount, value.skippedCount, value.duplicateCount];
  if (counts.some((count) => typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
      || value.responseCount !== people.length + (value.skippedCount as number) + (value.duplicateCount as number)) return null;
  return value as FormsRecipients;
}
