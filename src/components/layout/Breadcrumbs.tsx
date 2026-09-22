'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { chromeCrumbs } from '@/lib/chrome-breadcrumbs';

export function Breadcrumbs() {
  const pathname = usePathname() || '/';
  const items = chromeCrumbs(pathname);
  const prev = items.length > 1 ? items[items.length - 2] : null;
  const current = items[items.length - 1];

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-neutral-500">
      {items.length > 1 ? (
        <div className="flex min-w-0 items-center gap-1.5 md:hidden">
          {prev ? (
            <Link
              href={prev.href}
              className="inline-flex items-center gap-1 rounded-md py-1 text-neutral-400 transition-colors hover:text-neutral-100"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              <span className="max-w-[120px] truncate text-xs">{prev.label}</span>
            </Link>
          ) : null}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
          <span
            aria-current="page"
            className="max-w-40 truncate text-xs font-medium text-neutral-200"
            title={current?.label}
          >
            {current?.label}
          </span>
        </div>
      ) : (
        <div className="md:hidden">
          <span
            aria-current="page"
            className="max-w-[200px] truncate text-xs font-medium text-neutral-200"
            title={current?.label}
          >
            {current?.label}
          </span>
        </div>
      )}

      <ol role="list" className="hidden min-w-0 items-center md:flex">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li
              key={item.href}
              className={`inline-flex items-center gap-1.5 ${isLast ? 'shrink-0' : 'min-w-0'}`}
            >
              {idx > 0 ? (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
              ) : null}
              {isLast ? (
                <span
                  aria-current="page"
                  className="max-w-[180px] truncate font-medium text-neutral-200"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  title={item.label}
                  className="min-w-0 truncate rounded-md px-1.5 py-1 transition-colors hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
