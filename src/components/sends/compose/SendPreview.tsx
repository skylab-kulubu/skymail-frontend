'use client';

import { useState } from 'react';
import { MailFrame, SchemeToggle, SubjectPreview } from '@/components/mail-preview/MailPreview';
import type { SampleValues } from '@/lib/mail-render/preview';
import type { MailScheme } from '@/lib/template-editor/preview';
import type { MailTemplate } from '@/lib/templates';

/**
 * The mail as it goes out: the template's published body and subject — what
 * is sent — filled with this send's values, in either mail theme. The frame
 * is sandboxed with no flags (MailFrame): nothing in a body runs.
 */
export function SendPreview({ template, sample }: { template: MailTemplate | null; sample: SampleValues }) {
  const [scheme, setScheme] = useState<MailScheme>('light');
  return (
    <section aria-labelledby="send-preview-heading" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="send-preview-heading" className="text-sm font-medium text-neutral-100">
          Önizleme
        </h2>
        <SchemeToggle value={scheme} onChange={setScheme} />
      </div>
      {template ? (
        <>
          <p className="text-xs text-neutral-500">
            Yayımlanmış sürüm, bu gönderimin değerleriyle. Boş bir alan «Ad» olarak görünür; alıcının adı ve adresi her alıcı için
            doldurulur.
          </p>
          <SubjectPreview subject={template.subject} sample={sample} />
          <MailFrame title="Gönderim önizlemesi" html={template.html_content} sample={sample} scheme={scheme} className="h-[70vh] min-h-[420px]" />
        </>
      ) : (
        <MailFrame
          title="Gönderim önizlemesi"
          html={null}
          sample={sample}
          scheme={scheme}
          className="h-40"
          emptyText="Bir Mail template seçince önizleme burada."
        />
      )}
    </section>
  );
}
