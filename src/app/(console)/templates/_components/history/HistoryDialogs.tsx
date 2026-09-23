'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalPrimaryActions } from '@/components/ui/modal-actions';
import { useApiLoad } from '@/lib/api/react';
import { useRepoSample } from '@/lib/template-editor/use-repo-sample';
import {
  comparedVariables,
  comparisonFacts,
  fetchPublishedBefore,
  inSeqOrder,
  isFinalRestoreRefusal,
  versionBadge,
  versionLine,
  type ComparisonFact,
  type ComparisonRequest,
  type Standing,
} from '@/lib/template-history/history';
import { AUTHORING_MODE_LABEL, fetchVersion, type MailTemplate, type TemplateVersion, type TemplateVersionSummary } from '@/lib/templates';
import { RefusalNotice, type Refusal } from '../editor/EditorParts';
import { useSample } from '../editor/PreviewPane';
import { VersionSideBySide } from '../editor/VersionSideBySide';
import { VersionStateBadge } from './HistoryParts';

/**
 * Restoring a version: it becomes the viewer's new draft, started from what is
 * sent now, and nothing that is sent changes until they publish it. Their
 * draft in progress, if any, stays in the history.
 */
export function RestoreDialog({
  version,
  viewerSub,
  busy,
  refusal,
  onConfirm,
  onCancel,
}: {
  version: TemplateVersionSummary;
  viewerSub: string | null;
  busy: boolean;
  refusal: Refusal | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal isOpen onClose={onCancel} title="Sürümü geri getir">
      <div className="space-y-3">
        <p>
          <strong className="font-medium text-neutral-100">{versionLine(version, viewerSub)}</strong> senin yeni taslağın
          olarak açılır: adı, konusu, kaynakları ve Main source&apos;u ({AUTHORING_MODE_LABEL[version.main_mode]}) olduğu
          gibi. Taslak, şu an gönderilen sürümden başlamış sayılır.
        </p>
        <p>Gönderilen mail değişmez; taslağı yayımlayana kadar alıcılar bugünkü sürümü almaya devam eder.</p>
        <p>Süren bir taslağın varsa geçmişte kalır ve buradan yine geri getirilebilir; editör bundan sonra yeni taslağı açar.</p>
        {refusal ? <RefusalNotice refusal={refusal} /> : null}
        <ModalPrimaryActions
          onCancel={onCancel}
          onConfirm={onConfirm}
          confirmLabel="Taslak olarak geri getir"
          pendingLabel="Geri getiriliyor…"
          isPending={busy}
          confirmDisabled={refusal?.problem !== undefined && isFinalRestoreRefusal(refusal.problem)}
        />
      </div>
    </Modal>
  );
}

/** One row of what a comparison says in words: the same, or the older side's and the newer side's. */
function FactRow({ fact, olderSeq, newerSeq }: { fact: ComparisonFact; olderSeq: number; newerSeq: number }) {
  const quote = (text: string | null) => (text === null ? '—' : fact.kind === 'text' ? `“${text}”` : text);
  return (
    <tr className="border-t border-white/5 first:border-t-0">
      <th scope="row" className="w-28 py-1.5 pr-3 text-left align-top text-xs font-normal text-neutral-500">
        {fact.label}
      </th>
      <td className="min-w-0 py-1.5 text-sm break-words">
        {fact.same ? (
          <span className="text-neutral-400">
            Aynı{fact.newer !== null ? <span className="text-neutral-300">: {quote(fact.newer)}</span> : null}
          </span>
        ) : fact.kind === 'body' ? (
          <span className="text-amber-300">Farklı; render edilmiş hâlleri aşağıda.</span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-neutral-400">
              <span className="font-mono text-xs text-neutral-500">#{olderSeq}</span> {quote(fact.older)}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 self-center text-amber-300" role="img" aria-label="yerine" />
            <span className="text-amber-300">
              <span className="font-mono text-xs">#{newerSeq}</span> {quote(fact.newer)}
            </span>
          </span>
        )}
      </td>
    </tr>
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
  standing,
  onRestore,
  onClose,
}: {
  template: MailTemplate;
  pair: ComparisonRequest;
  viewerSub: string | null;
  standing: Standing;
  /** Null for a reader, who may compare but not restore. */
  onRestore: ((version: TemplateVersion) => void) | null;
  onClose: () => void;
}) {
  const against = 'againstId' in pair ? pair.againstId : `before-${pair.publishedBefore}`;
  const state = useApiLoad(async (api, signal) => {
    const againstId =
      'againstId' in pair ? pair.againstId : ((await fetchPublishedBefore(api, template.id, pair.publishedBefore, signal))?.id ?? null);
    if (againstId === null) return null;
    const [a, b] = await Promise.all([
      fetchVersion(api, template.id, pair.versionId, signal),
      fetchVersion(api, template.id, againstId, signal),
    ]);
    return inSeqOrder(a, b);
  }, `${pair.versionId}:${against}`);

  const [older, newer] = state.status === 'success' && state.data ? state.data : [null, null];
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
    actions: (
      <>
        <VersionStateBadge badge={versionBadge(version, standing)} />
        {onRestore && version.id !== standing.publishedVersionId ? (
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
          <table aria-label="Farklar" className="w-full table-fixed rounded-lg border border-white/10">
            <tbody className="[&_td]:pr-4 [&_th]:pl-4">
              {comparisonFacts(older, newer).map((fact) => (
                <FactRow key={fact.label} fact={fact} olderSeq={older.seq} newerSeq={newer.seq} />
              ))}
            </tbody>
          </table>
          <VersionSideBySide sides={[side(older), side(newer)]} viewerSub={viewerSub} sample={samples.sample} />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Kapat
            </Button>
          </div>
        </div>
      ) : (
        <StateCard title="Karşılaştırılacak bir sürüm yok" description="Bu sürümden önce yayımlanmış bir sürüm bulunamadı." />
      )}
    </Modal>
  );
}
