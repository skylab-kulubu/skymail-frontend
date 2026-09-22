'use client';

// Copied from superadmin (ADR-0017). The copy painted a light card with
// tailwind.config colours Tailwind 4 never loads; this one is the chrome's
// panel, and it behaves like the chrome's Drawer: a labelled modal dialog that
// takes focus, keeps Tab inside, and closes on Escape.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { isTopModalLayer, registerModalLayer } from '@/lib/ui/modal-layer';
import { useBodyScrollLock } from '@/lib/ui/use-body-scroll-lock';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  useBodyScrollLock(isOpen);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unregister = registerModalLayer(titleId);
    const dialog = dialogRef.current;
    // The first action in the body, not the close button, is what the dialog is for.
    (
      contentRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE) ??
      dialog
    )?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopModalLayer(titleId)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unregister();
      returnFocus?.focus();
    };
  }, [isOpen, titleId]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-neutral-900 shadow-2xl focus:outline-none"
      >
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <h2 id={titleId} className="min-w-0 flex-1 text-base font-semibold text-neutral-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="focus-visible:ring-skylab-400/40 rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div ref={contentRef} className="px-5 py-4 text-sm text-neutral-300">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
