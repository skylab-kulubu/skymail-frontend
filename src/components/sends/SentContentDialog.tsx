'use client';

// One recipient's mail as it went out: its subject, the HTML in a sandboxed
// frame and the plain text. The frame runs nothing and reaches nothing: no
// script (an empty sandbox), and no image, font or stylesheet from the
// network until the operator asks for images — a mail's tracking pixel must
// not count the operator as its recipient opening it. A mail that may carry a
// code or a one-time link comes masked from the server: each masked value is
// marked, in the subject, the plain text and the HTML.

import { useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button, FilterPills, Notice, StateCard } from '@skylab-kulubu/skylcn-ui';
import { PanelDialog } from '@/components/common/PanelDialog';
import { MailFrame, SchemeToggle } from '@/components/mail-preview/MailPreview';
import type { MailScheme, RemoteContent } from '@/components/mail-preview/preview-document';
import { useApiLoad } from '@/lib/api/react';
import {
  CONTENT_MISSING_TEXT,
  contentOpens,
  fetchSentContent,
  formatSendTime,
  MASK,
  maskedSegments,
  type SentContent,
} from '@/lib/sends';

type Part = 'html' | 'text';

const PARTS: ReadonlyArray<{ value: Part; label: string }> = [
  { value: 'html', label: 'HTML' },
  { value: 'text', label: 'Düz metin' },
];

export function SentContentDialog({
  sendId,
  rowId,
  recipient,
  onClose,
}: {
  sendId: string;
  rowId: string;
  /** Who the mail went to, as the recipient list names them. */
  recipient: string;
  onClose: () => void;
}) {
  const state = useApiLoad((api, signal) => fetchSentContent(api, sendId, rowId, signal), `${sendId}:${rowId}`);
  return (
    <PanelDialog isOpen onClose={onClose} title={`Gönderilen posta · ${recipient}`} size="wide">
      {state.status === 'loading' ? (
        <StateCard loading title="Posta yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="Posta yüklenemedi" description={state.error.message}>
          <Button variant="outline" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <SentMail content={state.data} />
      )}
    </PanelDialog>
  );
}

function SentMail({ content }: { content: SentContent }) {
  const [part, setPart] = useState<Part>('html');
  const [scheme, setScheme] = useState<MailScheme>('light');
  const [remote, setRemote] = useState<RemoteContent>('blocked');

  if (!contentOpens(content.access)) {
    return <p className="py-6 text-center text-subtle-foreground">{CONTENT_MISSING_TEXT[content.access]}</p>;
  }

  const masked = content.access === 'masked';
  const html = content.html ?? '';
  return (
    <div className="space-y-3">
      {masked ? <MaskedNotice content={content} /> : null}

      <p className="text-sm break-words text-secondary-foreground">
        <span className="text-2xs mr-2 font-medium tracking-[0.14em] text-subtle-foreground uppercase">Konu</span>
        {content.subject?.trim() ? (
          <span>
            <WithMasks text={content.subject} />
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPills aria-label="Postanın bölümü" value={part} onValueChange={setPart} options={PARTS} />
        {part === 'html' ? <SchemeToggle value={scheme} onChange={setScheme} /> : null}
        {part === 'html' ? (
          remote === 'blocked' ? (
            <Button variant="outline" size="sm" onClick={() => setRemote('allowed')}>
              Resimleri göster
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setRemote('blocked')}>
              Resimleri gizle
            </Button>
          )
        ) : null}
      </div>

      {part === 'html' ? (
        <>
          <p className="text-2xs text-subtle-foreground">
            {remote === 'blocked'
              ? 'Resimler ve dış içerik engellendi: posta açılırken hiçbir adrese istek gitmez.'
              : 'Resimler postanın gösterdiği adreslerden yükleniyor; o adresler postanın açıldığını görebilir.'}
          </p>
          {html.trim() === '' ? (
            <p className="py-6 text-center text-subtle-foreground">Bu postanın HTML bölümü yok.</p>
          ) : (
            <MailFrame title="Gönderilen postanın HTML'i" html={html} scheme={scheme} remote={remote} />
          )}
        </>
      ) : (
        <pre className="max-h-[65vh] overflow-auto rounded-lg border border-border p-3 text-xs break-words whitespace-pre-wrap text-secondary-foreground">
          {content.plain_text?.trim() ? <WithMasks text={content.plain_text} /> : '—'}
        </pre>
      )}

      {content.expires_at ? (
        <p className="text-2xs text-subtle-foreground">Bu içerik {formatSendTime(content.expires_at)} tarihinde silinir.</p>
      ) : null}
    </div>
  );
}

/** What a masked mail hides, said before the mail. */
function MaskedNotice({ content }: { content: SentContent }) {
  const variables = content.masked_variables ?? [];
  return (
    <Notice tone="info" icon={ShieldCheck} title="Kodlar ve bağlantılar gizlendi" aria-label="Maskeli içerik">
      Kodlar ve tek kullanımlık bağlantılar güvenlik için gizlendi: her biri <MaskMark /> olarak görünür, gerisi
      gönderildiği hâliyle. Bu açılış kaydedildi.
      {variables.length > 0 ? <> Gizlenen alanlar: {variables.join(', ')}.</> : null}
      {content.masked_by === 'patterns'
        ? ' Postanın şablonu bulunamadığı için içindeki bütün bağlantılar, uzun sayılar ve kodlar gizlendi.'
        : null}
    </Notice>
  );
}

/** A masked value, marked as the HTML part marks it. */
function MaskMark() {
  return (
    <mark data-skymail-masked="" className="rounded bg-warning/15 px-0.5 font-medium text-warning" title="Güvenlik için gizlendi">
      {MASK}
    </mark>
  );
}

/** Text with each masked value in it marked. */
function WithMasks({ text }: { text: string }) {
  return (
    <>
      {maskedSegments(text).map((segment, index) =>
        segment.masked ? <MaskMark key={index} /> : <span key={index}>{segment.text}</span>,
      )}
    </>
  );
}
