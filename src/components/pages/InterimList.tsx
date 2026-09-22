'use client';

import { AlertTriangle, Construction } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/tables/DataTable';
import { useApiQuery } from '@/lib/api/react';

type Column<T> = {
  key: keyof T & string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
};

/**
 * A section whose real screen is still being rewritten: its title, a note
 * saying so, and a read-only look at the first rows the API returns — enough
 * to show the section is reachable and the data path works.
 */
export function InterimList<T extends { id: string }>({
  title,
  description,
  path,
  columns,
}: {
  title: string;
  description: string;
  path: string;
  columns: Column<T>[];
}) {
  const state = useApiQuery<T[]>(path, { _start: 0, _end: 25 });

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-neutral-400">
        <Construction className="text-skylab-300 mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Bu ekran yeni panele taşınıyor. Şimdilik ilk 25 kaydı salt okunur gösteriyor.</p>
      </div>
      {state.status === 'loading' ? (
        <StateCard isLoading title="Yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard Icon={AlertTriangle} tone="danger" title="Liste yüklenemedi" description={state.error.message} />
      ) : (
        <DataTable data={state.data} columns={columns} emptyText="Henüz kayıt yok." />
      )}
    </div>
  );
}
