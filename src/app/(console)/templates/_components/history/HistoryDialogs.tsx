'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalPrimaryActions } from '@/components/ui/modal-actions';
import { useApiLoad } from '@/lib/api/react';
import {
  comparedVariables,
  comparisonFacts,
  inSeqOrder,
  versionAuthor,
  versionBadge,
  versionWhen,
  type ComparisonFact,
  type ComparisonRequest,
} from '@/lib/template-history/history';
import { useRepoSample } from '@/lib/template-editor/use-repo-sample';
import {
  AUTHORING_MODE_LABEL,
  fetchVersion,
  type MailTemplate,
  type TemplateVersion,
  type TemplateVersionSummary,
} from '@/lib/templates';
import { RefusalNotice, type Refusal } from '../editor/EditorParts';
import { useSample } from '../editor/PreviewPane';
import { VersionSideBySide } from '../editor/VersionSideBySide';
import { VersionStateBadge } from './HistoryParts';

/** "Mehmet Kaya · yayımlandı 22 Eyl 2026 10:12 · Main source JSX" */
export function versionByline(version: TemplateVersionSummary, viewerSub: string | null): string {
  return `${versionAuthor(version, viewerSub).label} · ${versionWhen(version)} · Main source ${AUTHORING_MODE_LABEL[version.main_mode] ?? version.main_mode}`;
}

/**
 * Restoring a version: it becomes the viewer's new draft, started from what is
 * sent now, and nothing that is sent changes until they publish it. Their
 * draft in progress, if any, stays in the history.
 */
export function RestoreDialog({
  version,
  viewerSub,
  viewerDraftSeq,
  busy,
  refusal,
  onConfirm,
  onCancel,
}: {
  version: TemplateVersionSummary;
  viewerSub: string | null;
  /** The viewer's draft in progress, which the restored copy takes the place of. */
  viewerDraftSeq: number | null;
  busy: boolean;
  refusal: Refusal | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal isOpen onClose={onCancel} title="Sürümü geri getir">
      <div className="space-y-3">
        <p>
          <strong className="font-medium text-neutral-100">Sürüm #{version.seq}</strong> ({versionByline(version, viewerSub)})
          senin yeni taslağın olarak açılır: adı, konusu, kaynakları ve Main source&apos;u olduğu gibi. Taslak, şu an
          gönderilen sürümden başlamış sayılır.
        </p>
        <p>Gönderilen mail değişmez; taslağı yayımlayana kadar alıcılar bugünkü sürümü almaya devam eder.</p>
        {viewerDraftSeq !== null ? (
          <p>
            Süren taslağın (#{viewerDraftSeq}) geçmişte kalır ve buradan yine geri getirilebilir; editör bundan sonra yeni
            taslağı açar.
          </p>
        ) : null}
        {refusal ? <RefusalNotice refusal={refusal} /> : null}
        <ModalPrimaryActions
          onCancel={onCancel}
          onConfirm={onConfirm}
          confirmLabel="Taslak olarak geri getir"
          pendingLabel="Geri getiriliyor…"
          isPending={busy}
        />
      </div>
    </Modal>
  );
}

function Fact({ fact, older, newer }: { fact: ComparisonFact; older: number; newer: number }) {
  const quote = (text: string | null) => (text === null ? '—' : `“${text}”`);
  return (
    <div className="grid gap-x-3 gap-y-0.5 py-1.5 sm:grid-cols-[7rem_1fr]">
      <dt className="text-xs text-neutral-500">{fact.label}</dt>
      <dd className="min-w-0 text-sm break-words">
        {fact.same ? (
          <span className="text-neutral-400">
            Aynı{fact.newer !== null ? <span className="text-neutral-300">: {quote(fact.newer)}</span> : null}
          </span>
        ) : fact.older === null && fact.newer === null ? (
          <span className="text-amber-300">Farklı; aşağıda render edilmiş hâlleri yan yana.</span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-neutral-400">
              <span className="font-mono text-xs text-neutral-500">#{older}</span> {quote(fact.older)}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 self-center text-amber-300" role="img" aria-label="yerine" />
            <span className="text-amber-300">
              <span className="font-mono text-xs">#{newer}</span> {quote(fact.newer)}
            </span>
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * Any two versions side by side as rendered mail, in both mail themes, with
 * what differs in name, subject and Main source said in words — the older on
 * the left. A writer can restore either one from here, except the one sent.
 */
export function VersionComparison({
  template,
  pair,
  viewerSub,
  draftsInProgress,
  onRestore,
  onClose,
}: {
  template: MailTemplate;
  pair: ComparisonRequest;
  viewerSub: string | null;
  draftsInProgress: readonly string[];
  /** Null for a reader, who may compare but not restore. */
  onRestore: ((version: TemplateVersion) => void) | null;
  onClose: () => void;
}) {
  const state = useApiLoad(async (api, signal) => {
    const [a, b] = await Promise.all([
      fetchVersion(api, template.id, pair.versionId, signal),
      fetchVersion(api, template.id, pair.againstId, signal),
    ]);
    return inSeqOrder(a, b);
  }, `${pair.versionId}:${pair.againstId}`);

  const [older, newer] = state.status === 'success' ? state.data : [null, null];
  const repo = useRepoSample(template.key);
  const samples = useSample(
    older && newer ? comparedVariables(older.html_content, newer.html_content) : [],
    null,
    older && newer ? `${older.subject}\n${newer.subject}` : '',
    repo,
    template.id,
  );

  const side = (version: TemplateVersion) => ({
    label: `Sürüm #${version.seq}`,
    version,
    line: versionByline(version, viewerSub),
    actions: (
      <>
        <VersionStateBadge badge={versionBadge(version, draftsInProgress)} />
        {onRestore && !version.current ? (
          <Button variant="outlineBrand" onClick={() => onRestore(version)} aria-label={`Geri getir: sürüm #${version.seq}`}>
            Geri getir
          </Button>
        ) : null}
      </>
    ),
  });

  return (
    <Modal isOpen onClose={onClose} title="Sürümleri karşılaştır" size="wide">
      {state.status === 'loading' ? (
        <StateCard isLoading title="Sürümler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard Icon={AlertTriangle} tone="danger" title="Sürümler yüklenemedi" description={state.error.message}>
          <Button variant="secondary" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : older && newer ? (
        <div className="space-y-4">
          <p>
            Önce eski olan (#{older.seq}), sonra yeni olan (#{newer.seq}); ikisi de gönderilecekleri gibi, aynı örnek
            değerlerle render edilmiş.
          </p>
          <dl aria-label="Farklar" className="divide-y divide-white/5 rounded-lg border border-white/10 px-4 py-1">
            {comparisonFacts(older, newer).map((fact) => (
              <Fact key={fact.label} fact={fact} older={older.seq} newer={newer.seq} />
            ))}
          </dl>
          <VersionSideBySide sides={[side(older), side(newer)]} viewerSub={viewerSub} sample={samples.sample} />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Kapat
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
