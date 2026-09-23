'use client';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
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
} as const;

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
  const { Icon, className } = TONE[notice.tone];
  const restore = notice.restore;
  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 break-words">{notice.text}</div>
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
    </div>
  );
}
