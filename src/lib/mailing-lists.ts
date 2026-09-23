/**
 * Mailing lists and their recipients, as skymail-backend `origin/main` serves
 * them (`internal/handlers/list.go`, routes under `/mailing_lists` in
 * `main.go`), and as the list screens show them.
 *
 * Two kinds of list share the routes. An internal list lives in SkyMail's
 * database: it can be created, renamed, archived and restored (archived, never
 * deleted — ADR-0042), and its recipients are added and removed here. A
 * Keycloak group is a list too: read-only, its members are the group's
 * members, and the API hands its path over as the `description`.
 */
import { ROLE, hasRole } from "./access";
import type { ApiClient } from "./api/client";
import { ApiError } from "./api/errors";
import { listViewQuery, pageRange, type ListView } from "./list-view";

/** One list as the API sends it (`handlers.MailingListItem`). */
export type MailingList = {
  id: string;
  name: string;
  /** A Keycloak group's path; internal lists have none. */
  description: string | null;
  created_at: string;
  updated_at: string;
  /** `internal` or `keycloak`. */
  source: string;
  /** Set on an archived internal list; only lists with `lifecycle=inactive|all` carry it. */
  archived_at?: string | null;
  archived_by?: string | null;
};

/** One recipient (`database.Recipient`); for a Keycloak group, one member. */
export type Recipient = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export const LIST_PAGE_SIZE = 25;
export const RECIPIENT_PAGE_SIZE = 25;

/** Why a Keycloak group list cannot be changed here. */
export const GROUP_READ_ONLY_REASON =
  "Bu liste Keycloak'taki bir gruptan geliyor, bu yüzden SkyMail'de salt okunur. Alıcıları grubun üyeleridir; " +
  "adı, üyeleri ve kendisi Keycloak'ta yönetilir. SkyMail'de yeniden adlandırılamaz, arşivlenemez, alıcı eklenip çıkarılamaz.";

/** The same, short enough to stand on a row of the list. */
export const GROUP_READ_ONLY_NOTE = "Salt okunur: Keycloak'ta yönetilir.";

/** Today's addresses; superadmin links to `show/<id>` and `create`. */
export const listHref = {
  index: "/mailing-lists",
  create: "/mailing-lists/create",
  show: (id: string) => `/mailing-lists/show/${encodeURIComponent(id)}`,
  edit: (id: string) => `/mailing-lists/edit/${encodeURIComponent(id)}`,
  archived: "/mailing-lists?lifecycle=inactive",
} as const;

/** What a row of the list screen shows. */
export type ListRow = Readonly<{
  id: string;
  name: string;
  /** A Keycloak group (or any source but internal): read-only, tagged Harici. */
  external: boolean;
  /** The Keycloak group path, shown under the name. */
  groupPath: string | null;
  /** When an internal list was created; the API has no such time for a group. */
  createdAt: string | null;
  archivedAt: string | null;
}>;

/** Whether SkyMail owns the list. Only `internal` does; an unknown source is treated as read-only. */
export function isInternal(list: Pick<MailingList, "source">): boolean {
  return list.source === "internal";
}

export function toListRow(list: MailingList): ListRow {
  const external = !isInternal(list);
  return {
    id: list.id,
    name: list.name,
    external,
    groupPath: external ? (list.description ?? null) : null,
    createdAt: external ? null : list.created_at,
    archivedAt: list.archived_at ?? null,
  };
}

/** Everything a list's row and page offer, decided in one place. */
export type ListActions = Readonly<{
  /** Its page opens; every read of an archived list answers 404, so it does not. */
  open: boolean;
  /** Rename and archive it, add and remove its recipients. */
  change: boolean;
  restore: boolean;
  /** Start a send to it: the API sends to an internal list and to a Keycloak group's members, never to an archived list. */
  compose: boolean;
  /** A Keycloak group: no one can change it in SkyMail, and every viewer is told so. */
  readOnly: boolean;
}>;

export function listActions(row: ListRow, roles: readonly string[]): ListActions {
  const archived = row.archivedAt !== null;
  const owned = !row.external && !archived;
  const canWrite = hasRole(roles, ROLE.listsWrite);
  return {
    open: !archived,
    change: owned && canWrite,
    restore: archived && canWrite,
    compose: !archived && hasRole(roles, ROLE.mailsWrite),
    readOnly: row.external,
  };
}

/**
 * Places one answer of `GET /mailing_lists` in the whole list.
 *
 * The API pages internal lists with `_start`/`_end` but appends every Keycloak
 * group to every page, while `X-Total-Count` counts them once. Read as one
 * list — internal lists, then groups — a page holds its slice of the internal
 * lists and whatever part of the groups falls inside its range.
 */
function placeGroups(
  items: MailingList[],
  total: number | null,
  range: { _start: number; _end: number },
): { rows: ListRow[]; total: number } {
  // Without the count the page cannot be placed: show what came back, once.
  if (total === null) return { rows: items.map(toListRow), total: range._start + items.length };
  const internals = items.filter(isInternal);
  const groups = items.filter((item) => !isInternal(item));
  const internalTotal = Math.max(0, total - groups.length);
  const from = Math.max(0, range._start - internalTotal);
  const to = Math.max(0, range._end - internalTotal);
  return { rows: [...internals, ...groups.slice(from, to)].map(toListRow), total };
}

export async function fetchListPage(
  api: ApiClient,
  view: ListView,
  signal?: AbortSignal,
): Promise<{ rows: ListRow[]; total: number }> {
  const query = listViewQuery(view, LIST_PAGE_SIZE);
  const page = await api.getPage<MailingList>("/mailing_lists", { query, signal });
  return placeGroups(page.items, page.total, query);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** List ids are UUIDs, both SkyMail's and Keycloak's. */
export function isListId(id: string): boolean {
  return UUID.test(id);
}

/**
 * One current list by id — an internal list or a Keycloak group. An archived
 * list answers 404. A malformed id would make the API answer 500, so it is
 * reported as the missing list it is, without a request.
 */
export async function fetchList(api: ApiClient, id: string, signal?: AbortSignal): Promise<MailingList> {
  if (!isListId(id)) throw new ApiError(404, "server.not_found");
  return api.get<MailingList>(`/mailing_lists/${id}`, { signal });
}

/**
 * One page of a list's recipients. An internal list is paged by the API; a
 * Keycloak group answers with every member at once, so it is paged here.
 */
export async function fetchRecipientPage(
  api: ApiClient,
  list: { id: string; external: boolean },
  page: number,
  signal?: AbortSignal,
): Promise<{ recipients: Recipient[]; total: number }> {
  const range = pageRange(page, RECIPIENT_PAGE_SIZE);
  const answer = await api.getPage<Recipient>(`/mailing_lists/${list.id}/recipients`, {
    query: range,
    signal,
  });
  if (list.external) {
    return {
      recipients: answer.items.slice(range._start, range._end),
      total: answer.total ?? answer.items.length,
    };
  }
  return { recipients: answer.items, total: answer.total ?? range._start + answer.items.length };
}

export function createList(api: ApiClient, name: string): Promise<MailingList> {
  return api.post<MailingList>("/mailing_lists", { name: name.trim() });
}

export function renameList(api: ApiClient, id: string, name: string): Promise<MailingList> {
  return api.patch<MailingList>(`/mailing_lists/${id}`, { name: name.trim() });
}

/** Archives an internal list (`DELETE`, 204). Recipients and past sends are kept. */
export function archiveList(api: ApiClient, id: string): Promise<void> {
  return api.delete(`/mailing_lists/${id}`);
}

export function restoreList(api: ApiClient, id: string): Promise<MailingList> {
  return api.post<MailingList>(`/mailing_lists/${id}/restore`);
}

export type RecipientInput = { full_name: string; email: string };

export function addRecipient(api: ApiClient, listId: string, input: RecipientInput): Promise<Recipient> {
  return api.post<Recipient>(`/mailing_lists/${listId}/recipients`, {
    full_name: input.full_name.trim(),
    email: input.email.trim(),
  });
}

/** Takes a recipient off the list (204); the recipient stays on their other lists. */
export function removeRecipient(api: ApiClient, listId: string, recipientId: string): Promise<void> {
  return api.delete(`/mailing_lists/${listId}/recipients/${recipientId}`);
}

/** The form's own check before the API's: a list needs a name. */
export function validateListName(name: string): string | null {
  return name.trim() ? null : "Liste adını gir.";
}

// One @, something on both sides, a dot in the domain, no spaces. The API
// checks the address properly; this only catches the obvious slip early.
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An address that could be one; the send form's people rows use the same check. */
export const isPlausibleEmail = (email: string) => PLAUSIBLE_EMAIL.test(email);

export function validateRecipient(input: RecipientInput): Partial<Record<keyof RecipientInput, string>> {
  const errors: Partial<Record<keyof RecipientInput, string>> = {};
  if (!input.full_name.trim()) errors.full_name = "Ad soyad gir.";
  const email = input.email.trim();
  if (!email) errors.email = "E-posta adresi gir.";
  else if (!isPlausibleEmail(email)) errors.email = "Geçerli bir e-posta adresi gir.";
  return errors;
}

