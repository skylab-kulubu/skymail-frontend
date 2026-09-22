'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalDangerActions } from '@/components/ui/modal-actions';
import { apiErrorMessage } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import { archiveList } from '@/lib/mailing-lists';
import type { NoticeData } from './Notice';

type ListRef = Readonly<{ id: string; name: string }>;

/** What the page says after an archive: the list is kept, and can come back. */
export function archivedNotice(list: ListRef): NoticeData {
  return {
    tone: 'success',
    text: `“${list.name}” arşivlendi. Alıcıları ve geçmiş gönderimleri korunuyor.`,
    restore: { id: list.id, name: list.name },
  };
}

/**
 * Asks before archiving `list`, archives it, and hands it to `onArchived`; the
 * dialog stays open, with the API's sentence, if the archive fails.
 */
export function ArchiveListDialog({
  list,
  onClose,
  onArchived,
}: {
  list: ListRef | null;
  onClose: () => void;
  onArchived: (list: ListRef) => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Modal isOpen={list !== null} onClose={() => (pending ? undefined : onClose())} title="Listeyi arşivle">
      {list ? (
        // Keyed by list, so an earlier attempt's error does not carry over.
        <ArchiveConfirm key={list.id} list={list} onCancel={onClose} onArchived={onArchived} onPending={setPending} />
      ) : null}
    </Modal>
  );
}

function ArchiveConfirm({
  list,
  onCancel,
  onArchived,
  onPending,
}: {
  list: ListRef;
  onCancel: () => void;
  onArchived: (list: ListRef) => Promise<void> | void;
  onPending: (pending: boolean) => void;
}) {
  const api = useApi();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    setPending(true);
    onPending(true);
    setError(null);
    try {
      await archiveList(api, list.id);
      await onArchived(list);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setPending(false);
      onPending(false);
    }
  }

  return (
    <>
      <p className="leading-relaxed">
        <strong className="font-medium text-neutral-100">“{list.name}”</strong> arşivlenecek. Alıcıları ve geçmiş
        gönderimleri silinmez; listeyi Mail listeleri ekranındaki Arşivli filtresinden geri alabilirsin. Arşivdeki bir
        listeye gönderim yapılamaz.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-red-300">
          {error}
        </p>
      ) : null}
      <ModalDangerActions
        onCancel={onCancel}
        onConfirm={() => void archive()}
        confirmLabel="Arşivle"
        pendingLabel="Arşivleniyor…"
        isPending={pending}
      />
    </>
  );
}
