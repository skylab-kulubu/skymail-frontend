'use client';

// Copied from superadmin (ADR-0017).

import { Button } from '@/components/ui/Button';

interface ModalDangerActionsProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  /** The action can no longer succeed (e.g. the API refused it for good); Cancel stays. */
  confirmDisabled?: boolean;
  className?: string;
}

/** Silme onayı modalları: İptal (gri) solda, Sil (kırmızı) sağda. */
export function ModalDangerActions({
  onCancel,
  onConfirm,
  cancelLabel = 'İptal',
  confirmLabel = 'Sil',
  pendingLabel = 'Siliniyor...',
  isPending = false,
  confirmDisabled = false,
  className,
}: ModalDangerActionsProps) {
  return (
    <div className={`${className ?? 'mt-4'} flex flex-wrap justify-end gap-2`}>
      <Button variant="secondary" onClick={onCancel} disabled={isPending}>
        {cancelLabel}
      </Button>
      <Button variant="danger" onClick={onConfirm} disabled={isPending || confirmDisabled}>
        {isPending ? pendingLabel : confirmLabel}
      </Button>
    </div>
  );
}

interface ModalPrimaryActionsProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel: string;
  pendingLabel?: string;
  isPending?: boolean;
  confirmDisabled?: boolean;
}

/** Onay modalları (silme dışı): İptal + birincil aksiyon. */
export function ModalPrimaryActions({
  onCancel,
  onConfirm,
  cancelLabel = 'İptal',
  confirmLabel,
  pendingLabel = 'İşleniyor...',
  isPending = false,
  confirmDisabled,
}: ModalPrimaryActionsProps) {
  return (
    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <Button variant="secondary" onClick={onCancel} disabled={isPending}>
        {cancelLabel}
      </Button>
      <Button onClick={onConfirm} disabled={isPending || confirmDisabled}>
        {isPending ? pendingLabel : confirmLabel}
      </Button>
    </div>
  );
}
