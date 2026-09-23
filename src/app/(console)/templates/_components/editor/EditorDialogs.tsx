'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalDangerActions, ModalPrimaryActions } from '@/components/ui/modal-actions';
import type { SampleValues } from '@/lib/mail-render/preview';
import { renderOf } from '@/lib/mail-render/save';
import type { SourceRender } from '@/lib/mail-render';
import type { MailScheme } from '@/lib/template-editor/preview';
import { AUTHORING_MODE_LABEL, type TemplateVersion } from '@/lib/templates';
import type { EditableMode } from '@/lib/template-editor/editor-state';
import { EditorNote, RefusalNotice, RenderWarnings, type Refusal } from './EditorParts';
import { MailFrame, SchemeToggle, SubjectPreview } from '@/components/mail-preview/MailPreview';
import { VersionSideBySide } from './VersionSideBySide';

export function PublishDialog({
  name,
  warnings,
  busy,
  onConfirm,
  onCancel,
}: {
  name: string;
  /** The draft's warnings, said again now that it is about to be sent. */
  warnings: readonly string[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal isOpen onClose={onCancel} title="Taslağı yayımla">
      <p>
        Taslağın yayımlanınca “{name}” bundan sonra bu sürümle gönderilir. Şu an gönderilen sürüm geçmişte kalır ve geri
        getirilebilir.
      </p>
      {warnings.length > 0 ? (
        <div className="mt-4">
          <RenderWarnings warnings={warnings} when="Yayımlamadan önce bak: bu taslakta düzeltilmesi iyi olacak şeyler var." />
        </div>
      ) : null}
      <ModalPrimaryActions
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Yayımla"
        pendingLabel="Yayımlanıyor…"
        isPending={busy}
      />
    </Modal>
  );
}

export function DiscardDialog({ busy, onConfirm, onCancel }: { busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal isOpen onClose={onCancel} title="Taslağı at">
      <p>
        Taslağın kimsenin süren taslağı olmaktan çıkar ve yayımlanmaz; geçmişte kalır ve geri getirilebilir. Editör
        yayımlanmış sürümü açar. Gönderilen mail değişmez.
      </p>
      <ModalDangerActions
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Taslağı at"
        pendingLabel="Atılıyor…"
        isPending={busy}
      />
    </Modal>
  );
}

/**
 * Making another source the Main source: what will be sent from then on,
 * rendered, before anything is saved. Confirming saves a draft with the new
 * mode; the other sources stay as they are.
 */
export function MainSourceDialog({
  candidate,
  render,
  source,
  kept,
  subject,
  sample,
  busy,
  refusal,
  onConfirm,
  onCancel,
}: {
  candidate: EditableMode;
  /** The candidate's last render; it must be of `source` to be confirmed. */
  render: SourceRender | null | undefined;
  source: string;
  /** The other Authoring modes the template has a source in. */
  kept: readonly EditableMode[];
  subject: string;
  sample: SampleValues;
  busy: boolean;
  refusal: Refusal | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [scheme, setScheme] = useState<MailScheme>('light');
  const label = AUTHORING_MODE_LABEL[candidate];
  const current = renderOf(render, { mode: candidate, source });
  return (
    <Modal isOpen onClose={onCancel} title={`${label} kaynağını Main source yap`} size="wide">
      <div className="space-y-4">
        <p>
          Gönderilen mail bundan sonra {label} kaynağından üretilir; aşağıdaki mail gönderilecek olan. Değişiklik bir
          taslak olarak kaydedilir, yayımlayana kadar canlı mail değişmez.{' '}
          {kept.length > 0
            ? `${kept.map((mode) => AUTHORING_MODE_LABEL[mode]).join(' ve ')} kaynağı olduğu gibi korunur.`
            : null}
        </p>
        <p>
          Bu değişikliğe yalnız {label} kaynağı ve Main source seçimi girer. Ad, konu ve diğer kaynaklardaki
          kaydedilmemiş değişikliklerin buna dahil değil; kaydedilmemiş olarak kalır.
        </p>
        {refusal ? <RefusalNotice refusal={refusal} /> : null}
        {current && !current.ok ? (
          <EditorNote tone="warning">
            {label} kaynağı render edilemedi, Main source yapılamaz: {current.message}
          </EditorNote>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SubjectPreview subject={subject} sample={sample} />
          <SchemeToggle value={scheme} onChange={setScheme} />
        </div>
        <MailFrame
          title="Main source adayı"
          html={current?.ok ? current.html : null}
          sample={sample}
          scheme={scheme}
          className="h-[55vh] min-h-[360px]"
        />
        <ModalPrimaryActions
          onCancel={onCancel}
          onConfirm={onConfirm}
          confirmLabel="Main source yap"
          pendingLabel="Kaydediliyor…"
          isPending={busy}
          confirmDisabled={!current?.ok}
        />
      </div>
    </Modal>
  );
}

/**
 * A draft someone else's publish overtook (ADR-0047, the other way round):
 * the draft and what is sent now, side by side as rendered mail. Publishing
 * the draft replaces the version shown here, by name; if yet another one is
 * published meanwhile, the API refuses and this is shown again with it.
 */
export function StaleComparison({
  draft,
  published,
  again,
  viewerSub,
  sample,
  busy,
  onConfirm,
  onCancel,
}: {
  draft: TemplateVersion;
  published: TemplateVersion | null;
  /** Shown again because another version was published while the operator compared. */
  again: boolean;
  viewerSub: string | null;
  sample: SampleValues;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal isOpen onClose={onCancel} title="Bu taslak bayat" size="wide">
      <div className="space-y-4">
        <p>
          Bu taslağı başlattıktan sonra başka bir sürüm yayımlandı. Taslağını yayımlarsan şu an gönderilen sürümün
          yerine geçer; o sürüm geçmişte kalır ve geri getirilebilir. İkisini karşılaştırıp seç.
        </p>
        {again ? (
          <EditorNote tone="warning">
            Sen karşılaştırırken bir sürüm daha yayımlandı; karşılaştırma onunla yenilendi. Hiçbir şey yayımlanmadı.
          </EditorNote>
        ) : null}
        <VersionSideBySide
          sides={[
            { label: 'Senin taslağın', version: draft },
            { label: 'Şu an gönderilen', version: published },
          ]}
          viewerSub={viewerSub}
          sample={sample}
        />
        <ModalDangerActions
          onCancel={onCancel}
          onConfirm={onConfirm}
          cancelLabel="Vazgeç"
          confirmLabel="Taslağımı yine de yayımla"
          pendingLabel="Yayımlanıyor…"
          isPending={busy}
        />
      </div>
    </Modal>
  );
}
