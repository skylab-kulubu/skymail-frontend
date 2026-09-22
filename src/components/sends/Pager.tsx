import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageCount } from '@/lib/sends';

const STEP =
  'inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-skylab-400/40 focus-visible:outline-none';
const STEP_OFF = 'inline-flex items-center gap-1 rounded-md border border-white/5 px-2.5 py-1.5 text-xs text-neutral-600';

/**
 * Previous / next through a list paged with `_start`/`_end`. Without a total
 * (the API's `X-Total-Count` did not reach the browser) a full page is taken
 * to mean another may follow.
 */
export function Pager({
  page,
  pageSize,
  total,
  rowsOnPage,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number | null;
  rowsOnPage: number;
  hrefFor: (page: number) => string;
}) {
  const last = total === null ? null : pageCount(total, pageSize);
  const hasNext = last === null ? rowsOnPage === pageSize : page < last;
  const hasPrevious = page > 1;
  if (!hasNext && !hasPrevious) return null;

  return (
    <nav aria-label="Sayfalar" className="flex items-center justify-between gap-3">
      {hasPrevious ? (
        <Link href={hrefFor(page - 1)} className={STEP} rel="prev">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Önceki
        </Link>
      ) : (
        <span className={STEP_OFF} aria-disabled="true">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Önceki
        </span>
      )}
      <span className="text-xs text-neutral-500 tabular-nums">
        {last === null ? `Sayfa ${page}` : `Sayfa ${page} / ${last}`}
      </span>
      {hasNext ? (
        <Link href={hrefFor(page + 1)} className={STEP} rel="next">
          Sonraki
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : (
        <span className={STEP_OFF} aria-disabled="true">
          Sonraki
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </nav>
  );
}
