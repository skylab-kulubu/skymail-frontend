'use client';

// Copied from superadmin (ADR-0017). The copy painted with tailwind.config
// colours Tailwind 4 never loads (bg-light, text-dark, divide-dark-200); these
// are the chrome's tokens, so the table reads in both themes. A wide table
// scrolls inside its own frame, never the page.

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: keyof T | string;
    header: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column values are whatever the row holds
    render?: (value: any, row: T) => React.ReactNode;
  }[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  getId?: (row: T) => string;
  idKey?: keyof T | string; // ID için key (getId yerine kullanılabilir)
  /** Shown when `data` is empty. */
  emptyText?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are plain API objects
export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onEdit,
  onDelete,
  getId,
  idKey = 'id',
  emptyText = 'Veri bulunamadı',
}: DataTableProps<T>) {
  const getRowId = (row: T): string => {
    if (getId) {
      return getId(row);
    }
    if (typeof idKey === 'string') {
      return String(idKey.split('.').reduce((obj, key) => obj?.[key], row) ?? '');
    }
    return String(row[idKey] ?? '');
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-white/5 bg-neutral-900">
      <table className="min-w-full divide-y divide-white/5">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className="text-2xs px-4 py-2.5 text-left font-medium tracking-wider text-neutral-500 uppercase"
              >
                {column.header}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th
                scope="col"
                className="text-2xs px-4 py-2.5 text-left font-medium tracking-wider text-neutral-500 uppercase"
              >
                İşlemler
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                className="px-4 py-6 text-center text-sm text-neutral-500"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={getRowId(row)} className="transition-colors hover:bg-white/[0.03]">
                {columns.map((column) => {
                  const value =
                    typeof column.key === 'string'
                      ? column.key.split('.').reduce((obj, key) => obj?.[key], row)
                      : row[column.key];

                  return (
                    <td
                      key={String(column.key)}
                      className="px-4 py-3 text-sm whitespace-nowrap text-neutral-200"
                    >
                      {column.render ? column.render(value, row) : String(value ?? '')}
                    </td>
                  );
                })}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                    <div className="flex gap-2">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="hover:text-skylab-300 cursor-pointer text-neutral-400"
                        >
                          Düzenle
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="cursor-pointer text-neutral-400 hover:text-red-300"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
