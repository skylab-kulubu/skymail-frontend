/**
 * Who opened a send's masked content (hub ticket skymail-frontend-rewrite 32;
 * skynotify-backend `GET /mail_tasks/{id}/content-views`): every opening of a
 * recipient's masked mail, newest first, paged with `X-Total-Count`. It names
 * the queue row, never the recipient; the page finds the recipient's name
 * among the send's rows (`GET /mail_tasks/{id}/queue`).
 *
 * Only `skynotify:audit:read` reads it (Yusuf, 2026-11-22: DK alone). The roles
 * that open the content do not: those audited do not read their own record.
 */
import type { ApiClient, ApiPage } from "./api/client";
import { ApiError } from "./api/errors";
import { hasRole, ROLE } from "./access";
import { pageRange } from "./list-view";
import { ERASED_PERSON, isErasedSubject, mailRecipientLabel } from "./people";
import type { RecipientRow } from "./sends";

export const CONTENT_VIEWS_PAGE_SIZE = 20;

export type ContentView = Readonly<{
  id: string;
  queue_item_id: string;
  /** As the opener's token named them; Account erasure replaces both. */
  actor: Readonly<{ sub: string | null; name: string | null }>;
  masked_by: "variables" | "patterns";
  masked_variables: readonly string[];
  created_at: string;
}>;

/** Whether the viewer reads who opened masked content. */
export function readsContentViews(roles: readonly string[]): boolean {
  return hasRole(roles, ROLE.auditRead);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fetchContentViews(api: ApiClient, sendId: string, page: number, signal?: AbortSignal): Promise<ApiPage<ContentView>> {
  if (!UUID.test(sendId)) return Promise.reject(new ApiError(404, "server.not_found"));
  return api.getPage<ContentView>(`/mail_tasks/${sendId}/content-views`, {
    query: pageRange(page, CONTENT_VIEWS_PAGE_SIZE),
    signal,
  });
}

/**
 * Whether the send's page shows "Kim açtı": once the viewer sees the send is
 * masked, always (an empty list says no one opened it); otherwise only once
 * an opening is there, so a send never masked shows nothing. A backend
 * without the route (404) or a role taken away since the token (403) shows
 * nothing; any other failure shows, to be tried again.
 */
export function showsContentViews(
  masked: boolean,
  answer: Readonly<{ status: "loading" } | { status: "error"; code: number } | { status: "success"; page: number; rows: number }>,
): boolean {
  if (answer.status === "error") return answer.code !== 403 && answer.code !== 404;
  if (masked) return true;
  return answer.status === "success" && (answer.page > 1 || answer.rows > 0);
}

/** Who opened it: their name, Silinmiş kullanıcı once their account was erased. */
export function viewerName(actor: ContentView["actor"]): string {
  if (isErasedSubject(actor.sub)) return ERASED_PERSON;
  return actor.name?.trim() || "Adı bilinmiyor";
}

/** How many of the send's rows are read to name the recipients: a sensitive send is mostly one mail. */
const QUEUE_PAGE_SIZE = 100;
const QUEUE_PAGES_READ = 5;

/**
 * The recipients' names of the rows the openings name, read from the send's
 * rows page by page until each is found (at most QUEUE_PAGES_READ pages). A
 * row not found has no name; the page then says only that it is a row.
 */
export async function fetchViewedRecipients(
  api: ApiClient,
  sendId: string,
  rowIds: readonly string[],
  signal?: AbortSignal,
): Promise<ReadonlyMap<string, string>> {
  const wanted = new Set(rowIds);
  const names = new Map<string, string>();
  for (let page = 1; page <= QUEUE_PAGES_READ && names.size < wanted.size; page++) {
    const rows = await api.getPage<RecipientRow>(`/mail_tasks/${sendId}/queue`, {
      query: pageRange(page, QUEUE_PAGE_SIZE),
      signal,
    });
    for (const row of rows.items) {
      if (wanted.has(row.id)) names.set(row.id, mailRecipientLabel(row.recipient_full_name, row.recipient_email).name);
    }
    if (rows.items.length < QUEUE_PAGE_SIZE) break;
  }
  return names;
}
