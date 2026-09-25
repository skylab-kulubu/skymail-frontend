/**
 * The view of a management list — which records and which page — kept in the
 * page's address (`?lifecycle=inactive&page=2`), so a refresh, the back button
 * or a shared link shows the same rows.
 *
 * Records are archived, never deleted (ADR-0042). skymail-backend's management
 * lists take `lifecycle=current|inactive|all` (default `current`) and page with
 * `_start`/`_end`, for Mail templates and mailing lists alike.
 */

export type Lifecycle = "current" | "inactive" | "all";

/** The Aktif · Arşivli · Hepsi filter, in the order it is shown. */
export const LIFECYCLE_FILTERS: ReadonlyArray<{ value: Lifecycle; label: string }> = [
  { value: "current", label: "Aktif" },
  { value: "inactive", label: "Arşivli" },
  { value: "all", label: "Hepsi" },
];

export type ListView = Readonly<{ lifecycle: Lifecycle; page: number }>;

const DEFAULT_VIEW: ListView = { lifecycle: "current", page: 1 };

/** One of a filter's values from the address's `key`; `fallback` for anything else. */
export function readOption<T extends string>(
  params: URLSearchParams,
  key: string,
  options: ReadonlyArray<{ value: T }>,
  fallback: T,
): T {
  const raw = params.get(key);
  return options.find((option) => option.value === raw)?.value ?? fallback;
}

/** The address's positive whole page number; 1 for anything else. */
export function readPage(params: URLSearchParams): number {
  const raw = params.get("page");
  return raw !== null && /^\d+$/.test(raw) && Number(raw) >= 1 ? Number(raw) : 1;
}

/**
 * `pathname` with a view's parts as its query, each given as
 * `[value, default]` and left out while it is its default.
 */
export function viewHref(
  pathname: string,
  parts: Readonly<Record<string, readonly [value: string | number, fallback: string | number]>>,
): string {
  const params = new URLSearchParams();
  for (const [key, [value, fallback]] of Object.entries(parts)) {
    if (value !== fallback) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/** The view an address asks for; anything it does not recognise falls back to the default. */
export function readListView(params: URLSearchParams): ListView {
  return { lifecycle: readOption(params, "lifecycle", LIFECYCLE_FILTERS, DEFAULT_VIEW.lifecycle), page: readPage(params) };
}

/** The address of `view` on `pathname`, leaving the defaults out. */
export function listViewHref(pathname: string, view: ListView): string {
  return viewHref(pathname, {
    lifecycle: [view.lifecycle, DEFAULT_VIEW.lifecycle],
    page: [view.page, DEFAULT_VIEW.page],
  });
}

/** The slice of the whole list a page covers, as `_start` (inclusive) and `_end` (exclusive). */
export function pageRange(page: number, pageSize: number): { _start: number; _end: number } {
  return { _start: (page - 1) * pageSize, _end: page * pageSize };
}

/** The API query for a view: its lifecycle filter and its page's slice. */
export function listViewQuery(
  view: ListView,
  pageSize: number,
): { lifecycle: Lifecycle; _start: number; _end: number } {
  return { lifecycle: view.lifecycle, ...pageRange(view.page, pageSize) };
}

/** How many pages `total` rows fill; an empty list still has its one page. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * How many pages to offer. Without the API's total (X-Total-Count did not
 * reach the browser) a full page may have another after it.
 */
export function knownPageCount(
  loaded: { total: number | null; rows: number },
  page: number,
  pageSize: number,
): number {
  if (loaded.total !== null) return pageCount(loaded.total, pageSize);
  return loaded.rows >= pageSize ? page + 1 : page;
}

/**
 * Where a page past the end — its last row archived, or a stale link — moves
 * to: the last page there is. Null while it exists or the count is unknown.
 */
export function pageToMoveTo(page: number, lastPage: number | null): number | null {
  return lastPage !== null && page > lastPage ? lastPage : null;
}
