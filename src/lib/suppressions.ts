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
 * Removing a bounce is skymail-bounce-isleme 08's.
 */
import type { ApiClient } from "./api/client";
import { asApiError } from "./api/errors";
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

export async function fetchSuppressionPage(api: ApiClient, { reason, page }: { reason: ReasonFilter; page: number }, signal?: AbortSignal): Promise<Page<Suppression>> {
  const query = { ...(reason === "all" ? {} : { reason }), ...pageRange(page, SUPPRESSION_PAGE_SIZE) };
  const answer = await api.getPage<Suppression>("/suppressions", { query, signal });
  return { rows: answer.items, total: answer.total ?? answer.items.length };
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
