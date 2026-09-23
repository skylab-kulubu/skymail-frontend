'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { FilterPills } from '@/components/chrome/FilterPills';
import { fillSampleValues, type SampleValues } from '@/lib/mail-render/preview';
import { previewDocument, type MailScheme } from './preview-document';

const SCHEMES: ReadonlyArray<{ value: MailScheme; label: string }> = [
  { value: 'light', label: 'Açık tema' },
  { value: 'dark', label: 'Koyu tema' },
];

/** Which theme the mail previews are shown in. */
export function SchemeToggle({ value, onChange }: { value: MailScheme; onChange: (scheme: MailScheme) => void }) {
  return <FilterPills value={value} onChange={onChange} options={SCHEMES} ariaLabel="Önizleme teması" />;
}

/**
 * A mail as a recipient sees it. The frame is sandboxed with no flags at all:
 * a body is markup someone wrote, and nothing in it — a script, a form, a
 * link that opens a window — runs or reaches the panel.
 */
export function MailFrame({
  title,
  html,
  sample,
  scheme,
  className = 'h-[65vh] min-h-[420px]',
  emptyText,
}: {
  title: string;
  /** Null while there is nothing to show yet. */
  html: string | null;
  /** The values filled in; none for a mail the server already rendered, shown as it is. */
  sample?: SampleValues;
  scheme: MailScheme;
  className?: string;
  /** What to say instead of "preparing" when nothing is coming. */
  emptyText?: string;
}) {
  const srcDoc = useMemo(() => (html === null ? null : previewDocument(html, { scheme, sample })), [html, scheme, sample]);
  if (srcDoc === null) {
    return (
      <div
        role="status"
        className={`flex items-center justify-center gap-2 rounded-lg border border-white/10 text-xs text-neutral-500 ${className}`}
      >
        {emptyText ?? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Önizleme hazırlanıyor…
          </>
        )}
      </div>
    );
  }
  return (
    <iframe
      title={title}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      style={{ colorScheme: scheme }}
      // Literal colours: the light theme redefines "white" as its ink.
      className={`block w-full rounded-lg border border-white/10 ${scheme === 'dark' ? 'bg-[#08070b]' : 'bg-[#ffffff]'} ${className}`}
    />
  );
}

/** The subject as it reaches an inbox: variables filled, as text. */
export function SubjectPreview({ subject, sample }: { subject: string; sample: SampleValues }) {
  const filled = fillSampleValues(subject, sample, { as: 'text' });
  return (
    <p className="text-sm break-words text-neutral-200">
      <span className="text-2xs mr-2 font-medium tracking-[0.14em] text-neutral-500 uppercase">Konu</span>
      {filled.trim() === '' ? <span className="text-neutral-500">—</span> : filled}
    </p>
  );
}
