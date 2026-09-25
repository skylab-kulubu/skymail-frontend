'use client';

/**
 * A new Mail template (`/templates/create`): its name, subject and first
 * source, JSX or HTML, with the same live preview as the editor. Creating goes
 * through today's `POST /templates`, which publishes the first version at
 * once; later changes are drafts in the editor.
 *
 * `POST /templates` takes no Visual source. A template started in Visual is
 * created with the plain HTML starter — that is its first published version,
 * and the page says so — and opens in the editor on an empty Visual
 * document; making the Visual source main is the next step there.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/chrome/FormField';
import { FilterPills } from '@/components/chrome/FilterPills';
import { PageHeader } from '@/components/layout/PageHeader';
import { RoleGate } from '@/components/layout/RoleGate';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { ROLE } from '@/lib/access';
import { useApi } from '@/lib/api/react';
import { flashNotice } from '@/lib/notice';
import { renderOf } from '@/lib/mail-render/save';
import { versionProblem } from '@/lib/template-editor/refusals';
import { HTML_STARTER, JSX_STARTER, planCreate } from '@/lib/template-editor/editor-state';
import { useRenderBridge, useSourceRenders } from '@/lib/template-editor/use-renders';
import { AUTHORING_MODE_LABEL, createTemplate, templateHref } from '@/lib/templates';
import { RefusalNotice, type Refusal } from './EditorParts';
import { PreviewPane, useSample } from './PreviewPane';
import { SourcePanel } from './SourcePane';

/** The modes a template can be created in: the ones `POST /templates` takes. */
const CREATE_MODES = ['jsx', 'html'] as const;

type CreateMode = (typeof CREATE_MODES)[number];

/** How the page starts a template: in a mode it can create, or in Visual by way of the HTML starter. */
type Start = CreateMode | 'visual';

const START_OPTIONS: ReadonlyArray<{ value: Start; label: string }> = [
  ...CREATE_MODES.map((mode) => ({ value: mode, label: AUTHORING_MODE_LABEL[mode] })),
  { value: 'visual', label: 'Visual ile başla' },
];

const NO_REPO_SAMPLE = {};

export function TemplateCreate() {
  return (
    <RoleGate role={ROLE.templatesWrite}>
      <CreateForm />
    </RoleGate>
  );
}

function CreateForm() {
  const api = useApi();
  const router = useRouter();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [start, setStart] = useState<Start>('jsx');
  // Visual is created as the HTML starter, rendered and previewed as such.
  const mode: CreateMode = start === 'visual' ? 'html' : start;
  // Both starters are kept: switching the first source's mode converts nothing and loses nothing.
  const [sources, setSources] = useState<Record<CreateMode, string>>({ jsx: JSX_STARTER, html: HTML_STARTER });
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [saving, setSaving] = useState(false);

  const bridge = useRenderBridge();
  const source = start === 'visual' ? HTML_STARTER : sources[mode];
  const wanted = useMemo(() => ({ [mode]: source }), [mode, source]);
  const { renders, good } = useSourceRenders(bridge, wanted);
  const current = renderOf(renders[mode], { mode, source });
  const samples = useSample(good[mode]?.variables, null, subject, NO_REPO_SAMPLE);

  async function create() {
    const plan = planCreate({ name, subject, mode, source }, renders[mode] ?? null);
    if (!plan.ok) {
      setRefusal({ title: 'Oluşturulmadı', blockers: plan.blockers });
      return;
    }
    setSaving(true);
    setRefusal(null);
    try {
      const created = await createTemplate(api, plan.body);
      flashNotice(templateHref.edit(created.id), {
        tone: 'success',
        text:
          start === 'visual'
            ? `“${created.name}” oluşturuldu. Yayımlanan ilk sürüm sade bir HTML başlangıcı; mail şimdilik onunla gider. Visual sekmesinde yaz, kaydet ve “Bu kaynağı Main source yap” ile gönderilen maili Visual kaynağından üret.`
            : `“${created.name}” oluşturuldu ve ilk sürümü yayımlandı. Bundan sonraki değişiklikler taslak olarak kaydedilir.`,
      });
      router.push(start === 'visual' ? templateHref.editStartingVisual(created.id) : templateHref.edit(created.id));
    } catch (error) {
      setRefusal({ title: 'Oluşturulmadı', problem: versionProblem(error) });
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Yeni Mail template"
        description="Adı, konusu ve ilk kaynağı. Oluşturmak ilk sürümü hemen yayımlar; sonraki değişiklikler editörde taslak olarak kaydedilir."
      />
      {refusal ? <RefusalNotice refusal={refusal} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Template adı" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" autoFocus />
        <FormField
          label="Konu"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Örn: {{.EventName}} için kaydın alındı"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="İlk kaynak" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <p className="text-sm font-medium text-neutral-200">İlk kaynak</p>
            <FilterPills value={start} onChange={setStart} options={START_OPTIONS} ariaLabel="İlk kaynağın Authoring mode'u" />
          </div>
          {start === 'visual' ? (
            <div className="space-y-2 pt-3 text-sm text-neutral-300">
              <p>
                Yeni bir template bir Visual belgeyle oluşturulamıyor. Bu yüzden ilk yayımlanan sürüm sade bir HTML
                başlangıcıdır (yandaki önizleme); template oluşturulunca mail şimdilik onunla gider.
              </p>
              <p>
                Oluşturunca editör Visual sekmesinde, boş bir belgeyle açılır. Yazıp kaydettikten sonra “Bu kaynağı Main
                source yap” ile gönderilen maili Visual kaynağından üretirsin; yayımlayana kadar canlı mail değişmez.
              </p>
            </div>
          ) : (
            <SourcePanel
              idPrefix="create"
              mode={mode}
              source={sources[mode]}
              onChange={(value) => setSources((previous) => ({ ...previous, [mode]: value }))}
              empty={null}
              underTabs={false}
            />
          )}
        </section>
        <PreviewPane
          html={good[mode]?.html ?? null}
          pending={!current}
          failure={current && !current.ok ? current.message : null}
          subject={subject}
          samples={samples}
        />
      </div>
      <FormActions
        cancel={
          <Button variant="secondary" href={templateHref.index} disabled={saving}>
            İptal
          </Button>
        }
        submit={
          <Button onClick={() => void create()} disabled={saving}>
            {saving ? 'Oluşturuluyor…' : 'Oluştur ve yayımla'}
          </Button>
        }
      />
    </div>
  );
}
