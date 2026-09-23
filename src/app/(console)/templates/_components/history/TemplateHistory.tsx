'use client';

/**
 * A Mail template's version history (`/templates/history/<id>`, ticket 14):
 * every version newest first — who wrote it, when, how it stands and which
 * mode was main — filtered by state and paged; any two compared as rendered
 * mail; and, for a writer, any one restored as a new draft, which the editor
 * then opens. Nothing here changes what is sent. A Template seed refused
 * because of an operator's change is said in full at the top.
 *
 * Which version is sent, and so which drafts are stale, is read from the
 * template: one source for the badges, the comparisons and the restores.
 */
import { useId, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { FilterPills } from '@/components/chrome/FilterPills';
import { Notice } from '@/components/chrome/Notice';
import { Pagination } from '@/components/chrome/Pagination';
import { StateCard } from '@/components/chrome/StateCard';
import { Tag } from '@/components/chrome/Tag';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROW_ACTION_CLASS } from '@/components/tables/RowActions';
import { Button } from '@/components/ui/Button';
import { ROLE, hasRole } from '@/lib/access';
import { useApi, useApiLoad } from '@/lib/api/react';
import { knownPageCount } from '@/lib/list-view';
import { flashNotice, useFlashNotice } from '@/lib/notice';
import { versionProblem } from '@/lib/template-editor/refusals';
import {
  HISTORY_FILTERS,
  HISTORY_PAGE_SIZE,
  defaultComparison,
  historyQuery,
  historyRows,
  historyViewHref,
  readHistoryView,
  requestedSubject,
  restoreOutcome,
  togglePick,
  versionAuthor,
  versionBadge,
  versionName,
  versionWhen,
  type ComparisonRequest,
  type HistoryRow,
  type HistoryState,
  type HistoryView,
  type Standing,
} from '@/lib/template-history/history';
import { fetchTemplate, fetchVersionPage, restoreVersion, templateHref, type MailTemplate, type TemplateVersionSummary } from '@/lib/templates';
import { useLastPage } from '@/lib/ui/use-last-page';
import type { Refusal } from '../editor/EditorParts';
import { TemplateLoadFailure } from '../editor/TemplateLoadFailure';
import { MainSource } from '../TemplateRowParts';
import { RestoreDialog, VersionComparison } from './HistoryDialogs';
import { SeedRefusalNotice, VersionStateBadge } from './HistoryParts';

export function TemplateHistory({ id }: { id: string }) {
  const state = useApiLoad((api, signal) => fetchTemplate(api, id, signal), id);
  if (state.status === 'loading') return <StateCard isLoading title="Sürüm geçmişi yükleniyor" />;
  if (state.status === 'error') return <TemplateLoadFailure error={state.error} onRetry={() => void state.reload()} />;
  return <History template={state.data} />;
}

const EMPTY_TEXT: Readonly<Record<HistoryState, string>> = {
  all: "Bu template'in henüz sürümü yok.",
  published: 'Yayımlanmış sürüm yok.',
  draft: 'Taslak yok.',
};

type Restoring = { version: TemplateVersionSummary; refusal: Refusal | null };

/** A version picked to compare, with the number the page says it by. */
type Picked = Readonly<{ id: string; seq: number }>;

function History({ template }: { template: MailTemplate }) {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname() || templateHref.history(template.id);
  const { roles, user } = useConsole();
  const viewerSub = user.sub ?? null;
  const canWrite = hasRole(roles, ROLE.templatesWrite);
  const view = readHistoryView(useSearchParams());
  const [notice, setNotice] = useFlashNotice(templateHref.history(template.id));

  const page = useApiLoad(
    (client, signal) => fetchVersionPage(client, template.id, historyQuery(view), signal),
    `${template.id}:${view.state}:${view.page}`,
  );
  const lastPage =
    page.status === 'success'
      ? knownPageCount({ total: page.data.total, rows: page.data.versions.length }, view.page, HISTORY_PAGE_SIZE)
      : null;

  // Picks outlive the filter and the page, so any two versions can be compared; the bar above says which.
  const [picked, setPicked] = useState<Picked[]>([]);
  const [comparing, setComparing] = useState<ComparisonRequest | null>(null);
  const [restoring, setRestoring] = useState<Restoring | null>(null);
  const [busy, setBusy] = useState(false);

  const sentId = template.published_version_id;
  const standing: Standing = { publishedVersionId: sentId, draftsInProgress: (template.drafts ?? []).map((draft) => draft.id) };

  function show(next: HistoryView) {
    router.push(historyViewHref(pathname, next), { scroll: false });
  }

  // A stale link past the end moves to the last page there is.
  useLastPage(view.page, lastPage, (last) => router.replace(historyViewHref(pathname, { ...view, page: last }), { scroll: false }));

  async function restore(target: Restoring) {
    setBusy(true);
    try {
      const outcome = restoreOutcome(await restoreVersion(api, template.id, target.version.id), target.version);
      if (outcome.openEditor) {
        // The editor opens the viewer's draft in progress: now the restored copy.
        flashNotice(templateHref.edit(template.id), { tone: 'success', text: outcome.text });
        router.push(templateHref.edit(template.id));
        return;
      }
      setRestoring(null);
      setComparing(null);
      setNotice({ tone: 'success', text: outcome.text });
      setBusy(false);
    } catch (error) {
      setRestoring({ ...target, refusal: { title: 'Geri getirilmedi', problem: versionProblem(error) } });
      setBusy(false);
    }
  }

  const item = (version: TemplateVersionSummary) => ({
    version,
    templateName: template.name,
    viewerSub,
    standing,
    picked: picked.some((pick) => pick.id === version.id),
    onPick: () => setPicked((current) => togglePick(current, { id: version.id, seq: version.seq })),
    comparison: defaultComparison(version, sentId),
    onCompare: setComparing,
    onRestore: canWrite && version.id !== sentId ? () => setRestoring({ version, refusal: null }) : null,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sürüm geçmişi"
        description={`“${template.name}” Mail template'inin her sürümü, en yenisi önce. Her kaydetme, yayım ve Template seed bir sürüm yazar; gönderilen, yayımlanmış olanlardan biridir. Saatler İstanbul saati.`}
        meta={
          <>
            {template.system ? <Tag tone="system">System</Tag> : null}
            {template.key ? <span className="font-mono text-xs break-all text-neutral-400">{template.key}</span> : null}
          </>
        }
        actions={
          <Button variant="secondary" href={canWrite ? templateHref.edit(template.id) : templateHref.show(template.id)}>
            {canWrite ? 'Editöre dön' : "Template'e dön"}
          </Button>
        }
      />

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
      <SeedRefusalNotice template={template} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterPills
            ariaLabel="Gösterilen sürümler"
            value={view.state}
            options={HISTORY_FILTERS}
            onChange={(next) => show({ state: next, page: 1 })}
          />
          <p className="text-xs text-neutral-500 tabular-nums" aria-live="polite">
            {page.status === 'success' && page.data.total !== null ? `${page.data.total} sürüm` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-neutral-500" aria-live="polite">
            {picked.length === 0
              ? 'Yan yana görmek için iki sürüm seç.'
              : `${picked.length} sürüm seçili: ${picked.map((pick) => `#${pick.seq}`).join(' ve ')}${picked.length === 1 ? '; bir tane daha seç.' : '.'}`}
          </p>
          {picked.length > 0 ? (
            <button type="button" onClick={() => setPicked([])} className={`${ROW_ACTION_CLASS} text-xs text-neutral-400 hover:text-neutral-200`}>
              Seçimi temizle
            </button>
          ) : null}
          <Button
            variant="outlineBrand"
            disabled={picked.length !== 2}
            onClick={() => setComparing({ versionId: picked[0].id, againstId: picked[1].id })}
          >
            Seçilenleri karşılaştır
          </Button>
        </div>
      </div>

      {page.status === 'loading' ? (
        <StateCard isLoading title="Sürümler yükleniyor" />
      ) : page.status === 'error' ? (
        <StateCard Icon={AlertTriangle} tone="danger" title="Sürümler yüklenemedi" description={page.error.message}>
          <Button variant="secondary" onClick={() => void page.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : (
        <div className="space-y-2">
          <ul aria-label="Sürümler" className="divide-y divide-white/5 rounded-lg border border-white/5">
            {page.data.versions.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-neutral-500">{EMPTY_TEXT[view.state]}</li>
            ) : (
              historyRows(page.data.versions).map((row) => <RowItem key={row.version.id} row={row} item={item} />)
            )}
          </ul>
          <Pagination
            ariaLabel="Sürüm sayfaları"
            current={view.page}
            totalPages={lastPage ?? 1}
            onPageChange={(next) => show({ ...view, page: next })}
          />
        </div>
      )}

      {comparing ? (
        <VersionComparison
          template={template}
          pair={comparing}
          viewerSub={viewerSub}
          standing={standing}
          onRestore={canWrite ? (version) => setRestoring({ version, refusal: null }) : null}
          onClose={() => setComparing(null)}
        />
      ) : null}
      {restoring ? (
        <RestoreDialog
          version={restoring.version}
          viewerSub={viewerSub}
          busy={busy}
          refusal={restoring.refusal}
          onConfirm={() => void restore(restoring)}
          onCancel={() => setRestoring(null)}
        />
      ) : null}
    </div>
  );
}

type ItemProps = Parameters<typeof VersionItem>[0];

/**
 * One row: a version, and the earlier saves one operator made on the same
 * base folded under it, opened on demand; each can be picked or restored.
 */
function RowItem({ row, item }: { row: HistoryRow; item: (version: TemplateVersionSummary) => ItemProps }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { version, earlier } = row;
  return (
    <li aria-label={`Sürüm #${version.seq}`} className="px-4 py-3">
      <VersionItem {...item(version)} />
      {earlier.length > 0 ? (
        <div className="mt-2 pl-7">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((current) => !current)}
            className={`${ROW_ACTION_CLASS} inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200`}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            Aynı taslağın {earlier.length} önceki kaydı ({earlier.length === 1 ? `#${earlier[0].seq}` : `#${earlier.at(-1)?.seq}–#${earlier[0].seq}`})
          </button>
          <ul id={listId} hidden={!open} aria-label={`Sürüm #${version.seq} öncesi kayıtlar`} className="mt-2 space-y-3 border-l border-white/10 pl-3">
            {earlier.map((save) => (
              <li key={save.id} aria-label={`Sürüm #${save.seq}`}>
                <VersionItem {...item(save)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/** One version: its number, how it stands, its Main source mode, who wrote it and when, its subject. */
function VersionItem({
  version,
  templateName,
  viewerSub,
  standing,
  picked,
  onPick,
  comparison,
  onCompare,
  onRestore,
}: {
  version: TemplateVersionSummary;
  templateName: string;
  viewerSub: string | null;
  standing: Standing;
  picked: boolean;
  onPick: () => void;
  /** What its Karşılaştır shows; null when there is nothing to compare it with. */
  comparison: ComparisonRequest | null;
  onCompare: (pair: ComparisonRequest) => void;
  /** Null when the viewer may not restore it, or it is the version sent. */
  onRestore: (() => void) | null;
}) {
  const author = versionAuthor(version, viewerSub);
  const badge = versionBadge(version, standing);
  const name = versionName(version, templateName);
  const asked = requestedSubject(version);
  // The one sent is compared with what came before it; any other with the one sent.
  const compareLabel = badge.state === 'sent' ? 'Öncekiyle karşılaştır' : 'Gönderilenle karşılaştır';
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={picked}
        onChange={onPick}
        aria-label={`Karşılaştırmak için seç: sürüm #${version.seq}`}
        className="accent-skylab-500 mt-1 h-4 w-4 shrink-0 cursor-pointer"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-sm font-medium text-neutral-100">#{version.seq}</span>
          <VersionStateBadge badge={badge} />
          <MainSource mode={version.main_mode} />
        </div>
        <p className="text-xs text-neutral-400">
          <span className={author.kind === 'unknown' ? 'text-neutral-500 italic' : 'text-neutral-300'}>{author.label}</span>
          {' · '}
          {versionWhen(version)}
        </p>
        {author.beforeHistory ? (
          <p className="text-2xs text-neutral-500">
            Sürüm geçmişi tutulmadan önceki içerik: yazanı kaydedilmedi, zamanı template&apos;in o güne kadarki son
            değişikliği.
          </p>
        ) : null}
        <p className="text-sm break-words text-neutral-300">
          <span className="text-neutral-500">Konu: </span>
          {version.subject}
        </p>
        {name !== null ? (
          <p className="text-xs break-words text-neutral-400">
            <span className="text-neutral-500">Bu sürümdeki ad: </span>“{name}”
          </p>
        ) : null}
        {asked !== null ? (
          <p className="text-xs break-words text-neutral-500">Template seed bu konuyu istemişti: “{asked}”; yukarıdaki korundu.</p>
        ) : null}
        {comparison || onRestore ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
            {comparison ? (
              <button
                type="button"
                onClick={() => onCompare(comparison)}
                aria-label={`${compareLabel}: sürüm #${version.seq}`}
                className={`${ROW_ACTION_CLASS} text-skylab-300 font-medium hover:underline`}
              >
                {compareLabel}
              </button>
            ) : null}
            {onRestore ? (
              <button
                type="button"
                onClick={onRestore}
                aria-label={`Geri getir: sürüm #${version.seq}`}
                className={`${ROW_ACTION_CLASS} text-skylab-300 font-medium hover:underline`}
              >
                Geri getir
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
