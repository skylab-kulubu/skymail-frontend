'use client';

// Copied from superadmin (ADR-0017).

import { ArrowLeft, ArrowRight } from 'lucide-react';

type PaginationProps = {
  current?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
};

export function Pagination({
  current = 1,
  totalPages = 1,
  onPageChange,
  className = '',
}: PaginationProps) {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safeCurrent = Math.min(Math.max(1, Number(current) || 1), safeTotalPages);
  if (safeTotalPages <= 1) return null;

  const goTo = (page: number) => {
    const next = Math.min(Math.max(page, 1), safeTotalPages);
    if (next !== safeCurrent) onPageChange?.(next);
  };

  const pageNumbers: Array<number | string> = (() => {
    const pages: Array<number | string> = [];
    if (safeTotalPages <= 5) {
      for (let i = 1; i <= safeTotalPages; i += 1) pages.push(i);
    } else if (safeCurrent <= 3) {
      pages.push(1, 2, 3, 4, 'ellipsis1', safeTotalPages);
    } else if (safeCurrent >= safeTotalPages - 2) {
      pages.push(1, 'ellipsis1');
      for (let i = safeTotalPages - 3; i <= safeTotalPages; i += 1) {
        if (i > 1) pages.push(i);
      }
    } else {
      pages.push(
        1,
        'ellipsis1',
        safeCurrent - 1,
        safeCurrent,
        safeCurrent + 1,
        'ellipsis2',
        safeTotalPages,
      );
    }
    return pages;
  })();

  return (
    <div className="sticky bottom-0 z-20 bg-neutral-900">
      <div className={`flex flex-wrap items-center justify-center gap-1 pt-3 ${className}`}>
        <button
          type="button"
          onClick={() => goTo(safeCurrent - 1)}
          aria-label="Önceki sayfa"
          disabled={safeCurrent <= 1}
          className={`focus-visible:ring-skylab-400/40 flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            safeCurrent <= 1
              ? 'cursor-not-allowed border-white/10 bg-white/5 text-neutral-500 opacity-60'
              : 'hover:border-skylab-400/40 hover:bg-skylab-500/10 border-white/10 bg-white/3 text-neutral-200'
          }`}
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/3 px-1 py-0.5 shadow-sm">
          {pageNumbers.map((pageNum) => {
            if (typeof pageNum === 'string') {
              return (
                <span key={pageNum} className="px-1 text-xs text-neutral-500">
                  ...
                </span>
              );
            }
            const isCurrentPage = pageNum === safeCurrent;
            return (
              <button
                type="button"
                key={pageNum}
                onClick={() => goTo(pageNum)}
                aria-label={`Sayfa ${pageNum}`}
                className={`focus-visible:ring-skylab-400/40 h-7 w-7 rounded-md text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  isCurrentPage
                    ? 'border-skylab-400/40 bg-skylab-500/15 text-skylab-300 border'
                    : 'text-neutral-300 hover:bg-white/10 hover:text-neutral-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => goTo(safeCurrent + 1)}
          aria-label="Sonraki sayfa"
          disabled={safeCurrent >= safeTotalPages}
          className={`focus-visible:ring-skylab-400/40 flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            safeCurrent >= safeTotalPages
              ? 'cursor-not-allowed border-white/10 bg-white/5 text-neutral-500 opacity-60'
              : 'hover:border-skylab-400/40 hover:bg-skylab-500/10 border-white/10 bg-white/3 text-neutral-200'
          }`}
        >
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
