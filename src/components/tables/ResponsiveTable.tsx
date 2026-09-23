'use client';

import { Fragment, type ComponentProps, type ReactNode } from 'react';
import { DataTable } from './DataTable';

/**
 * A list a phone can read without scrolling sideways: stacked rows below the
 * `md` breakpoint (`renderItem` returns each one's `<li>`), the table from it
 * up. Both say `emptyText` when there are no rows.
 */
export function ResponsiveTable<T extends { id: string }>({
  rows,
  columns,
  emptyText,
  renderItem,
}: {
  rows: T[];
  columns: ComponentProps<typeof DataTable<T>>['columns'];
  emptyText: string;
  renderItem: (row: T) => ReactNode;
}) {
  return (
    <>
      {rows.length > 0 ? (
        <ul className="divide-y divide-white/5 rounded-lg border border-white/5 md:hidden">
          {rows.map((row) => (
            <Fragment key={row.id}>{renderItem(row)}</Fragment>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-white/5 px-4 py-6 text-center text-sm text-neutral-500 md:hidden">
          {emptyText}
        </p>
      )}
      <div className="hidden md:block">
        <DataTable<T> data={rows} columns={columns} emptyText={emptyText} />
      </div>
    </>
  );
}
