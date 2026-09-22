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

function parseLifecycle(raw: string | null): Lifecycle {
  return LIFECYCLE_FILTERS.find((filter) => filter.value === raw)?.value ?? DEFAULT_VIEW.lifecycle;
}

function parsePage(raw: string | null): number {
  return raw !== null && /^\d+$/.test(raw) && Number(raw) >= 1 ? Number(raw) : DEFAULT_VIEW.page;
}

/** The view an address asks for; anything it does not recognise falls back to the default. */
export function readListView(params: URLSearchParams): ListView {
  return { lifecycle: parseLifecycle(params.get("lifecycle")), page: parsePage(params.get("page")) };
}

/** The address of `view` on `pathname`, leaving the defaults out. */
export function listViewHref(pathname: string, view: ListView): string {
  const params = new URLSearchParams();
  if (view.lifecycle !== DEFAULT_VIEW.lifecycle) params.set("lifecycle", view.lifecycle);
  if (view.page !== DEFAULT_VIEW.page) params.set("page", String(view.page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
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
