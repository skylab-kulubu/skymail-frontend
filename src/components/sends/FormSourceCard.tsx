'use client';

import { ClipboardList } from 'lucide-react';
import { useConsole } from '@/components/layout/ConsoleContext';
import { formResponsesHref, type FormSource } from '@/lib/form-mail-source';
import { formatCount, formatSendTime } from '@/lib/sends';

export function FormSourceCard({ source }: { source: FormSource }) {
  const { config } = useConsole();
  const console = config.consoles.find((item) => item.id === 'forms');
  const href = console ? formResponsesHref(console.href, source.form_id) : null;
  return (
    <div className="space-y-2 rounded-lg border border-border-subtle p-3.5">
      <p className="flex items-start gap-2 text-sm font-medium text-foreground"><ClipboardList className="h-4 w-4 shrink-0" aria-hidden />{source.form_title}</p>
      <p className="text-sm text-secondary-foreground">{formatCount(source.recipient_count)} yanıtlayan</p>
      <p className="text-xs text-subtle-foreground">Hazırlanma: {formatSendTime(source.prepared_at)}</p>
      <p className="text-xs text-muted-foreground">Bu alıcılar sabittir. Yeni yanıtları dahil etmek için Forms'tan yeni bir gönderim hazırla; onay gerekiyorsa yeniden onaya sunulur.</p>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-skylab-300 hover:underline">Forma git</a> : null}
    </div>
  );
}
