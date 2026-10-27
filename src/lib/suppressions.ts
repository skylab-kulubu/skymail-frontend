/**
 * The suppression list and the reversal of an unsubscribe (hub ticket
 * abonelik-cikisi 04; ADR 0072 decision 7; skymail-backend #98).
 *
 *  - `GET /suppressions` gives both records, `reason` bounce (every stream)
 *    or unsubscribed (the duyuru stream), `?reason=` keeping one.
 *  - An unsubscribed row is reversed only when the person asks or after a
 *    mistake, by one with `skymail:unsubscribes:reactivate`, with a reason of
 *    10–500 characters that names no address
 *    (`POST /suppressions/{id}/reactivate`).
 *  - `GET /suppressions/reactivations` says who reversed one, when and why,
 *    without the address; the same role reads it.
 *
 *  - A bounce row is removed by one with `skymail:suppressions:manage`
 *    (`DELETE /suppressions/{id}`; skymail-bounce-isleme 08, ADR 0073
 *    decision 7): mail goes to the address again. The same role reads the
 *    bounce rate and the NDR reader's state (`GET /suppressions/bounces`).
 *
 * `GET /suppressions` takes either role.
 */
import type { ApiClient } from "./api/client";
import { asApiError } from "./api/errors";
import { formatDateTime } from "./format";
import { pageRange } from "./list-view";
import { ERASED_PERSON, isErasedSubject } from "./people";

export type SuppressionReason = "bounce" | "unsubscribed";

export type Suppression = Readonly<{
  id: string;
  address: string;
  reason: SuppressionReason;
  stream: "all" | "duyuru";
  source: "dsn" | "smtp" | "link";
  reason_code?: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  /** When account mail (a login code, a verification, a password reset) last went to a bounced address anyway; null if never. */
  exempt_flagged_at?: string | null;
}>;

export type Reactivation = Readonly<{
  id: number;
  actor: "recipient" | "operator";
  actor_sub: string | null;
  reason: string | null;
  stream: "duyuru";
  source: "link";
  unsubscribed_at: string;
  reactivated_at: string;
}>;

export const SUPPRESSIONS_PATH = "/suppressions";
export const SUPPRESSION_PAGE_SIZE = 50;

/** A row's reason and the stream it holds back. */
export const REASON_LABEL: Readonly<Record<SuppressionReason, string>> = {
  bounce: "Kalıcı ret · tüm postalar",
  unsubscribed: "Abonelikten çıktı · duyurular",
};

export type ReasonFilter = "all" | SuppressionReason;

export const REASON_FILTERS: ReadonlyArray<{ value: ReasonFilter; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "bounce", label: "Kalıcı ret" },
  { value: "unsubscribed", label: "Abonelikten çıktı" },
];

export type Page<T> = Readonly<{ rows: T[]; total: number }>;

export async function fetchSuppressionPage(
  api: ApiClient,
  { reason, page, q = "" }: { reason: ReasonFilter; page: number; q?: string },
  signal?: AbortSignal,
): Promise<Page<Suppression>> {
  const search = q.trim();
  const query = { ...(reason === "all" ? {} : { reason }), ...(search ? { q: search } : {}), ...pageRange(page, SUPPRESSION_PAGE_SIZE) };
  const answer = await api.getPage<Suppression>("/suppressions", { query, signal });
  return { rows: answer.items, total: answer.total ?? answer.items.length };
}

const SOURCE_LABEL: Readonly<Record<Suppression["source"], string>> = {
  dsn: "Teslim raporu",
  smtp: "Gönderimde ret",
  link: "Çıkış bağlantısı",
};

/** Where a row came from, with the failure's codes (the API keeps no text). */
export function sourceLabel(row: Pick<Suppression, "source" | "reason_code">): string {
  const code = row.reason_code?.trim();
  return code ? `${SOURCE_LABEL[row.source]} · ${code}` : SOURCE_LABEL[row.source];
}

/** A bounced address that account mail still went to (ADR 0073 decision 6); null if none did. */
export function exemptNote(row: Pick<Suppression, "exempt_flagged_at">): string | null {
  return row.exempt_flagged_at ? `Hesap postası gitti · ${formatDateTime(row.exempt_flagged_at)}` : null;
}

export async function removeSuppression(api: ApiClient, id: string): Promise<void> {
  await api.delete(`/suppressions/${encodeURIComponent(id)}`);
}

/** A refused removal in words; `reload` when the list no longer holds the row as it was. */
export function removeRefusal(error: unknown): { text: string; reload: boolean } {
  const refusal = asApiError(error);
  if (refusal.status === 403) return { text: "Kaldırma yetkin yok (skymail:suppressions:manage).", reload: false };
  if (refusal.status === 404) return { text: "Kayıt artık listede yok.", reload: true };
  if (refusal.code === "suppression.use_reactivate") return { text: refusal.message, reload: true };
  return { text: refusal.message, reload: false };
}

export const REMOVE_WARNING = "Bu adrese yeniden posta gider. Adres hâlâ yoksa bir sonraki ret onu yeniden listeye alır.";

/** One sender mailbox's last read by the NDR reader (SKYMAIL_BOUNCE_READER). */
export type BounceReaderState = Readonly<{
  mailbox: string;
  mode: "dry-run" | "on";
  last_polled_at: string | null;
  last_error: string | null;
}>;

/** The e-mails sent in the last `days` and what reports said of them (`GET /suppressions/bounces`). */
export type BounceSummary = Readonly<{
  days: number;
  sent: number;
  hard: number;
  soft: number;
  delay: number;
  hard_rate: number;
  reader: readonly BounceReaderState[];
}>;

export const BOUNCE_DAYS = 30;

export function fetchBounceSummary(api: ApiClient, days: number = BOUNCE_DAYS, signal?: AbortSignal): Promise<BounceSummary> {
  return api.get<BounceSummary>("/suppressions/bounces", { query: { days }, signal });
}

const COUNT = new Intl.NumberFormat("tr-TR");
const RATE = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });

/** "1.200 gönderildi", "6 ulaşmadı (%0,5)", …: only what happened. */
export function bounceSummaryParts(summary: BounceSummary): string[] {
  if (summary.sent === 0 && summary.hard === 0 && summary.soft === 0 && summary.delay === 0) return ["Gönderim yok"];
  const parts = [`${COUNT.format(summary.sent)} gönderildi`];
  if (summary.hard) parts.push(`${COUNT.format(summary.hard)} ulaşmadı (${RATE.format(summary.hard_rate)})`);
  if (summary.soft) parts.push(`${COUNT.format(summary.soft)} yumuşak ret`);
  if (summary.delay) parts.push(`${COUNT.format(summary.delay)} gecikme`);
  return parts;
}

const READER_MODE: Readonly<Record<BounceReaderState["mode"], string>> = { on: "açık", "dry-run": "deneme" };

/** "hesap@… · açık · son yoklama 27.10.2026 13:00", with the last error if any. */
export function readerLine(state: BounceReaderState): string {
  const read = state.last_polled_at ? `son yoklama ${formatDateTime(state.last_polled_at)}` : "henüz yoklanmadı";
  const line = `${state.mailbox} · ${READER_MODE[state.mode] ?? state.mode} · ${read}`;
  return state.last_error ? `${line} · hata: ${state.last_error}` : line;
}

export async function fetchReactivationPage(api: ApiClient, page: number, signal?: AbortSignal): Promise<Page<Reactivation>> {
  const answer = await api.getPage<Reactivation>("/suppressions/reactivations", { query: pageRange(page, SUPPRESSION_PAGE_SIZE), signal });
  return { rows: answer.items, total: answer.total ?? answer.items.length };
}

export const REACTIVATE_WARNING = "Yalnız kişi isterse ya da bir hata olduysa geri al. Kişi kendi çıkışını postadaki bağlantıdan da geri alabilir.";
export const REASON_MIN = 10;
export const REASON_MAX = 500;

export const REASON_LENGTH = `Gerekçe ${REASON_MIN}–${REASON_MAX} karakter olmalı.`;

/** A line break, a tab or another control character: the backend takes printable characters and the plain space only (unicode.IsPrint). */
const LINE_BREAK = /[\n\r\t\v\f\u0085\u2028\u2029]/u;
const INVISIBLE = /[\p{C}\p{Z}]/u;

/** Why the reason may not go yet, as the backend counts it (characters, one line, no address); null when it may. */
export function reasonProblem(text: string): string | null {
  const reason = text.trim();
  const length = [...reason].length;
  if (length < REASON_MIN || length > REASON_MAX) return REASON_LENGTH;
  if (LINE_BREAK.test(reason)) return "Gerekçe tek satır olmalı.";
  if ([...reason].some((char) => char !== " " && INVISIBLE.test(char))) return "Gerekçede görünmeyen bir karakter var.";
  if (reason.includes("@")) return "Gerekçeye adres yazma.";
  return null;
}

export async function reactivate(api: ApiClient, id: string, reason: string): Promise<void> {
  await api.post(`/suppressions/${encodeURIComponent(id)}/reactivate`, { reason: reason.trim() });
}

/** A refused reversal in words; `reload` when the list no longer holds the row as it was. */
export function reactivateRefusal(error: unknown): { text: string; reload: boolean } {
  const refusal = asApiError(error);
  if (refusal.status === 403) return { text: "Geri alma yetkin yok (skymail:unsubscribes:reactivate).", reload: false };
  if (refusal.status === 404) return { text: "Kayıt artık listede yok: kişi geri almış ya da hesap silinmiş olabilir.", reload: true };
  if (refusal.code === "suppression.use_delete") return { text: refusal.message, reload: true };
  return { text: refusal.message, reload: false };
}

/** Who reversed it: the person on their link's page, or an operator by their Keycloak subject. */
export function reactivatedBy(reactivation: Pick<Reactivation, "actor" | "actor_sub">): string {
  if (reactivation.actor === "recipient") return "Kişinin kendisi";
  if (isErasedSubject(reactivation.actor_sub)) return ERASED_PERSON;
  return reactivation.actor_sub ? `Panel (${reactivation.actor_sub})` : "Panel";
}
