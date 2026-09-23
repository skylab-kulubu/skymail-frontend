'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { ApiClient } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/errors';
import { useApi, useApiLoad } from '@/lib/api/react';
import { listViewHref, pageCount, readListView, type ListView } from '@/lib/list-view';
import { useFlashNotice, type NoticeData } from '@/lib/notice';
import { useLastPage } from './use-last-page';

/** A record a list archives and restores, as its notices and dialog name it. */
export type ArchivableRecord = Readonly<{ id: string; name: string }>;

/**
 * A management list whose records are archived, never deleted (ADR-0042),
 * and brought back with Geri al: the mailing lists and the Mail templates.
 *
 * It keeps the view (Aktif · Arşivli · Hepsi and the page) in the address and
 * moves a page that emptied to the last one there is; loads the view; and
 * reports an archive or a restore as a notice, next to the rows it changed.
 */
export function useArchivableList<Page extends { total: number }>({
  index,
  pageSize,
  load,
  restore,
  archivedNotice,
  canRestore,
}: {
  /** The list's own address: where notices are flashed to it from other pages. */
  index: string;
  pageSize: number;
  load: (api: ApiClient, view: ListView, signal: AbortSignal) => Promise<Page>;
  restore: (api: ApiClient, id: string) => Promise<unknown>;
  /** What the page says once a record is archived; it offers Geri al. */
  archivedNotice: (record: ArchivableRecord) => NoticeData;
  /** Whether the viewer may restore, so the notice offers Geri al. */
  canRestore: boolean;
}) {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname() || index;
  const view = readListView(useSearchParams());

  const [notice, setNotice] = useFlashNotice(index);
  const [toArchive, setToArchive] = useState<ArchivableRecord | null>(null);
  // Per row: two restores in flight must not clear each other's busy state.
  const [restoring, setRestoring] = useState<ReadonlySet<string>>(() => new Set());

  const state = useApiLoad((client, signal) => load(client, view, signal), `${view.lifecycle}:${view.page}`);
  const lastPage = state.status === 'success' ? pageCount(state.data.total, pageSize) : null;

  function show(next: ListView) {
    router.push(listViewHref(pathname, next), { scroll: false });
  }

  // A page that emptied — its last row archived, or a stale link — moves to the last page there is.
  useLastPage(view.page, lastPage, (page) => router.replace(listViewHref(pathname, { lifecycle: view.lifecycle, page }), { scroll: false }));

  function markRestoring(id: string, busy: boolean) {
    setRestoring((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function restoreRecord(record: ArchivableRecord) {
    markRestoring(record.id, true);
    try {
      await restore(api, record.id);
      await state.reload();
      setNotice({ tone: 'success', text: `“${record.name}” geri alındı; yeniden aktif.` });
    } catch (error) {
      setNotice({ tone: 'error', text: `“${record.name}” geri alınamadı. ${apiErrorMessage(error)}` });
    } finally {
      markRestoring(record.id, false);
    }
  }

  return {
    view,
    state,
    lastPage,
    show,
    isRestoring: (id: string) => restoring.has(id),
    restore: (record: ArchivableRecord) => void restoreRecord(record),
    /** The props of the page's `<Notice>`, or null when there is nothing to say. */
    notice: notice
      ? {
          notice,
          onDismiss: () => setNotice(null),
          onRestore: canRestore ? (record: ArchivableRecord) => void restoreRecord(record) : undefined,
          restoring: notice.restore ? restoring.has(notice.restore.id) : false,
        }
      : null,
    /** The props of the page's archive dialog, and how a row opens it. */
    archiveDialog: {
      record: toArchive,
      onClose: () => setToArchive(null),
      onArchived: async (record: ArchivableRecord) => {
        await state.reload();
        setToArchive(null);
        setNotice(archivedNotice(record));
      },
    },
    askArchive: (record: ArchivableRecord) => setToArchive(record),
  };
}
