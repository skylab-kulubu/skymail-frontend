'use client';

// A management list as a real table, drawn like skylcn-ui's DataList (its
// column labels, row padding and hover wash); a wide table scrolls inside its
// own frame, never the page. Kept a <table> so the rows read as one to every
// screen reader and the pages' columns stay content-sized.

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: keyof T | string;
    header: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column values are whatever the row holds
    render?: (value: any, row: T) => React.ReactNode;
  }[];
  /** Shown when `data` is empty. */
  emptyText?: string;
}

const HEADER = 'text-3xs tracking-label text-subtle-foreground px-3 pt-3 pb-2 text-left font-medium uppercase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are plain API objects
export function DataTable<T extends Record<string, any>>({ data, columns, emptyText = 'Veri bulunamadı' }: DataTableProps<T>) {
  return (
    <div className="border-border-subtle overflow-x-auto rounded-lg border">
      <table className="divide-border-subtle min-w-full divide-y">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} scope="col" className={HEADER}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border-subtle divide-y">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-subtle-foreground px-3 py-6 text-center text-sm">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={String(row.id ?? index)} className="hover:bg-card transition-colors duration-(--motion-duration-fast)">
                {columns.map((column) => {
                  const value =
                    typeof column.key === 'string'
                      ? column.key.split('.').reduce((obj, key) => obj?.[key], row)
                      : row[column.key];
                  return (
                    <td key={String(column.key)} className="text-secondary-foreground px-3 py-2.5 text-sm whitespace-nowrap">
                      {column.render ? column.render(value, row) : String(value ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
