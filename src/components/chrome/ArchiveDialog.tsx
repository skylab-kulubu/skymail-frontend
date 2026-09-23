'use client';

import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalDangerActions } from '@/components/ui/modal-actions';
import { apiErrorMessage } from '@/lib/api/errors';

type Archivable = Readonly<{ id: string }>;

/**
 * Asks before archiving `record`, archives it, and hands it to `onArchived`.
 * The dialog stays open, with the API's sentence, if the archive fails; when
 * `isFinalRefusal` says the failure would only repeat (a System template),
 * Arşivle is disabled and only İptal is left. `children` says what archiving
 * keeps and where the record can be restored.
 */
export function ArchiveDialog<T extends Archivable>({
  record,
  title,
  archive,
  isFinalRefusal,
  onClose,
  onArchived,
  children,
}: {
  record: T | null;
  title: string;
  archive: (record: T) => Promise<void>;
  isFinalRefusal?: (error: unknown) => boolean;
  onClose: () => void;
  onArchived: (record: T) => Promise<void> | void;
  children: (record: T) => ReactNode;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Modal isOpen={record !== null} onClose={() => (pending ? undefined : onClose())} title={title}>
      {record ? (
        // Keyed by record, so an earlier attempt's error does not carry over.
        <ArchiveConfirm
          key={record.id}
          record={record}
          archive={archive}
          isFinalRefusal={isFinalRefusal}
          onCancel={onClose}
          onArchived={onArchived}
          onPending={setPending}
        >
          {children(record)}
        </ArchiveConfirm>
      ) : null}
    </Modal>
  );
}

function ArchiveConfirm<T extends Archivable>({
  record,
  archive,
  isFinalRefusal,
  onCancel,
  onArchived,
  onPending,
  children,
}: {
  record: T;
  archive: (record: T) => Promise<void>;
  isFinalRefusal?: (error: unknown) => boolean;
  onCancel: () => void;
  onArchived: (record: T) => Promise<void> | void;
  onPending: (pending: boolean) => void;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);

  async function confirm() {
    setPending(true);
    onPending(true);
    setError(null);
    try {
      await archive(record);
      await onArchived(record);
    } catch (reason) {
      setError(apiErrorMessage(reason));
      setRefused(isFinalRefusal?.(reason) ?? false);
    } finally {
      setPending(false);
      onPending(false);
    }
  }

  return (
    <>
      {children}
      {error ? (
        <p role="alert" className="mt-3 text-red-300">
          {error}
        </p>
      ) : null}
      <ModalDangerActions
        onCancel={onCancel}
        onConfirm={() => void confirm()}
        confirmLabel="Arşivle"
        pendingLabel="Arşivleniyor…"
        isPending={pending}
        confirmDisabled={refused}
      />
    </>
  );
}
