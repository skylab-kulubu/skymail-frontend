'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NoticeData } from '@/lib/notice';

const TONE = {
  success: {
    Icon: CheckCircle2,
    className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  },
  error: {
    Icon: AlertTriangle,
    className: 'border-red-400/30 bg-red-500/10 text-red-300',
  },
  warning: {
    Icon: AlertTriangle,
    className: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  },
  info: {
    Icon: Info,
    className: 'border-white/10 bg-white/[0.03] text-neutral-300',
  },
} as const;

export type NoticeTone = keyof typeof TONE;

/**
 * The box every notice is drawn in: an icon for its tone, then what it says.
 * An error is announced at once (`alert`); anything else politely (`status`).
 * `after` holds the notice's own buttons.
 */
export function NoticeBox({
  tone,
  children,
  after,
}: {
  tone: NoticeTone;
  children: ReactNode;
  after?: ReactNode;
}) {
  const { Icon, className } = TONE[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {after}
    </div>
  );
}

/**
 * The outcome of an action, said in words: a success as a success, an error
 * as the API's Turkish sentence. A notice that reports an archive offers
 * "Geri al" when the page passes `onRestore`.
 */
export function Notice({
  notice,
  onDismiss,
  onRestore,
  restoring = false,
}: {
  notice: NoticeData;
  onDismiss?: () => void;
  onRestore?: (record: { id: string; name: string }) => void;
  restoring?: boolean;
}) {
  const restore = notice.restore;
  return (
    <NoticeBox
      tone={notice.tone}
      after={
        <>
          {restore && onRestore ? (
            <button
              type="button"
              disabled={restoring}
              onClick={() => onRestore(restore)}
              className="focus-visible:ring-skylab-400/40 shrink-0 rounded text-sm font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              {restoring ? 'Geri alınıyor…' : 'Geri al'}
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Bildirimi kapat"
              className="focus-visible:ring-skylab-400/40 -m-1 shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </>
      }
    >
      {notice.text}
    </NoticeBox>
  );
}
