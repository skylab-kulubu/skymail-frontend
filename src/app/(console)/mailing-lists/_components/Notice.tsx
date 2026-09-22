'use client';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { ReactNode } from 'react';

export type NoticeData = Readonly<{
  tone: 'success' | 'error';
  text: string;
  /** An archived list the notice can bring back ("Geri al"). */
  restore?: Readonly<{ id: string; name: string }>;
}>;

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

/** The outcome of an action, said in words: a success as a success, an error as the API's Turkish sentence. */
export function Notice({
  tone,
  children,
  action,
  onDismiss,
}: {
  tone: NoticeData['tone'];
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const { Icon, className } = TONE[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
