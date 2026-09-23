'use client';

import { ArchiveDialog } from '@/components/chrome/ArchiveDialog';
import type { NoticeData } from '@/components/chrome/Notice';
import { useApi } from '@/lib/api/react';
import { archiveList } from '@/lib/mailing-lists';

type ListRef = Readonly<{ id: string; name: string }>;

/** What the page says after an archive: the list is kept, and can come back. */
export function archivedNotice(list: ListRef): NoticeData {
  return {
    tone: 'success',
    text: `“${list.name}” arşivlendi. Alıcıları ve geçmiş gönderimleri korunuyor.`,
    restore: { id: list.id, name: list.name },
  };
}

/** Asks before archiving `list`, archives it, and hands it to `onArchived`. */
export function ArchiveListDialog({
  list,
  onClose,
  onArchived,
}: {
  list: ListRef | null;
  onClose: () => void;
  onArchived: (list: ListRef) => Promise<void> | void;
}) {
  const api = useApi();
  return (
    <ArchiveDialog
      record={list}
      title="Listeyi arşivle"
      archive={(target) => archiveList(api, target.id)}
      onClose={onClose}
      onArchived={onArchived}
    >
      {(target) => (
        <p className="leading-relaxed">
          <strong className="font-medium text-neutral-100">“{target.name}”</strong> arşivlenecek. Alıcıları ve geçmiş
          gönderimleri silinmez; listeyi Mail listeleri ekranındaki Arşivli filtresinden geri alabilirsin. Arşivdeki
          bir listeye gönderim yapılamaz.
        </p>
      )}
    </ArchiveDialog>
  );
}
