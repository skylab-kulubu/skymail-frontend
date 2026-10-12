'use client';

import { Button, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@skylab-kulubu/skylcn-ui';
import type { ReactNode } from 'react';

const SIZE = {
  md: '',
  /** Holds content side by side (two mails, say) and scrolls within the screen. */
  wide: 'sm:max-w-6xl',
} as const;

/**
 * SkyMail's dialogs on skylcn-ui's Dialog: a title, then the body with its own
 * buttons at the end (DangerActions, PrimaryActions). Focus starts on the
 * body's first control, stays inside, and returns on close; Escape and a click
 * outside call `onClose`, which a dialog busy with a request may ignore.
 */
export function PanelDialog({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: keyof typeof SIZE;
  children: ReactNode;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className={SIZE[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="text-secondary-foreground text-sm">{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

type ActionsProps = {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  /** The action can no longer succeed (e.g. the API refused it for good); İptal stays. */
  confirmDisabled?: boolean;
  className?: string;
};

function Actions({
  onCancel,
  onConfirm,
  cancelLabel = 'İptal',
  confirmLabel,
  pendingLabel,
  isPending = false,
  confirmDisabled = false,
  className,
  destructive,
}: ActionsProps & { confirmLabel: string; pendingLabel: string; destructive: boolean }) {
  return (
    <div className={`${className ?? 'mt-4'} flex flex-wrap justify-end gap-2`}>
      <Button variant="outline" onClick={onCancel} disabled={isPending}>
        {cancelLabel}
      </Button>
      <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm} disabled={isPending || confirmDisabled}>
        {isPending ? pendingLabel : confirmLabel}
      </Button>
    </div>
  );
}

/** A removal's buttons: İptal, then the red action (Sil by default). */
export function DangerActions({ confirmLabel = 'Sil', pendingLabel = 'Siliniyor...', ...props }: ActionsProps) {
  return <Actions {...props} confirmLabel={confirmLabel} pendingLabel={pendingLabel} destructive />;
}

/** Any other confirmation's buttons: İptal, then the action. */
export function PrimaryActions({ pendingLabel = 'İşleniyor...', ...props }: ActionsProps & { confirmLabel: string }) {
  return <Actions {...props} pendingLabel={pendingLabel} destructive={false} />;
}
