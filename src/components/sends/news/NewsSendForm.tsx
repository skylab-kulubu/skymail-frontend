'use client';

// "Haberden gönder" (hub ticket duyuru-haber 08; SPEC §5.7): a published News
// record mailed to every member or to some teams. The panel and the site open
// it as /mail-tasks/create?source=news&slug=<slug>; SkyMail's send list opens
// it with no slug, to type one in. Every step reads skymail-backend: the
// preview is the server's own rendering of club.news, the count is core's, a
// test mail goes to the viewer's own address only, and the send is queued by
// the server. Only skymail:announcements:send sends; a Mail onayı path for
// news sends comes with a later backend version.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, SearchX } from 'lucide-react';
import {
  Button,
  MultiSelect,
  Notice,
  SegmentedControl,
  StateCard,
  Stepper,
} from '@skylab-kulubu/skylcn-ui';
import { FormField } from '@/components/common/FormField';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { MailFrame, SchemeToggle } from '@/components/mail-preview/MailPreview';
import type { MailScheme } from '@/components/mail-preview/preview-document';
import { apiErrorMessage, asApiError } from '@/lib/api/errors';
import { useApi, useApiLoad } from '@/lib/api/react';
import {
  countParts,
  emptyNewsDraft,
  fetchNewsAvailability,
  fetchNewsCount,
  mailLinks,
  newsAccess,
  newsSendHref,
  NEWS_PREHEADER_MAX,
  NEWS_SUBJECT_MAX,
  previewNewsMail,
  sendNews,
  sendProblems,
  teamOptions,
  testNewsMail,
  type NewsDraft,
  type NewsFormat,
} from '@/lib/news-send';
import { flashNotice } from '@/lib/notice';
import { COMMERCIAL_STATEMENT } from '@/lib/send-form/purpose';
import { fetchSendableLists } from '@/lib/send-form/send';
import { sendAccess } from '@/lib/send-form/access';
import { formatCount, sendHref, SEND_LIST_PATH } from '@/lib/sends';

const STEPS = [
  { id: 'content', label: 'İçerik' },
  { id: 'audience', label: 'Kitle' },
  { id: 'format', label: 'Biçim' },
  { id: 'subject', label: 'Konu' },
  { id: 'test', label: 'Deneme' },
  { id: 'review', label: 'Gözden geçir' },
] as const;

const FORMAT_OPTIONS = [
  { value: 'full', label: 'Tam metin' },
  { value: 'summary', label: 'Özet + bağlantı' },
];

const AUDIENCE_OPTIONS = [
  { value: 'members', label: 'Tüm üyeler' },
  { value: 'teams', label: 'Ekipler' },
];

const WIDTH_OPTIONS = [
  { value: 'desktop', label: 'Masaüstü' },
  { value: 'mobile', label: 'Mobil' },
];

/** value, once it has stopped changing for a moment: typing a subject asks the server once, not per key. */
function useSettled<T>(value: T, ms = 400): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function NewsSendForm({ slug, problem }: { slug: string; problem?: string }) {
  const { roles } = useConsole();
  const access = newsAccess(roles);
  const availability = useApiLoad((api, signal) => fetchNewsAvailability(api, signal), 'news-availability');

  if (!access.prepare) {
    return <StateCard icon={AlertTriangle} tone="warning" title="Haberden gönderim için yetkin yok" description="Haberi göndermek ya da hazırlamak için SkyMail'de gönderim yetkisi gerekiyor." />;
  }
  if (availability.status === 'loading') return <StateCard loading title="Haberden gönderim hazırlanıyor" />;
  if (availability.status === 'error') {
    return (
      <StateCard icon={AlertTriangle} tone="danger" title="Haberden gönderim açılamadı" description={availability.error.message}>
        <Button variant="outline" onClick={() => void availability.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }
  if (!availability.data.available) {
    return <StateCard icon={AlertTriangle} tone="warning" title="Haberden gönderim kapalı" description="SkyMail'de haberden gönderim henüz açılmadı." />;
  }
  if (problem) return <StateCard icon={SearchX} title="Haber adresi geçersiz" description={problem} />;
  if (!slug) return <SlugPicker />;
  return <NewsCompose key={slug} slug={slug} canSend={access.send} />;
}

/** No record in the address: its slug, typed in. */
function SlugPicker() {
  const router = useRouter();
  const [value, setValue] = useState('');
  return (
    <div className="space-y-4">
      <PageHeader title="Haberden gönder" description="Yayımlanmış bir haberi ya da duyuruyu e-postayla gönder." />
      <form
        className="flex max-w-xl flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) router.push(newsSendHref(value.trim()));
        }}
      >
        <div className="min-w-0 flex-1">
          <FormField label="Haberin adresi (slug)" hint="Sitedeki adresin son parçası: yildizskylab.com/haberler/bahar-kayitlari için bahar-kayitlari." value={value} onChange={(event) => setValue(event.target.value)} />
        </div>
        <Button type="submit" variant="primary" disabled={!value.trim()}>
          Aç
        </Button>
      </form>
    </div>
  );
}

function NewsCompose({ slug, canSend }: { slug: string; canSend: boolean }) {
  const api = useApi();
  const router = useRouter();
  const { roles } = useConsole();
  const [draft, setDraft] = useState<NewsDraft>(() => emptyNewsDraft(slug));
  const settled = useSettled(draft);
  const set = (patch: Partial<NewsDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const previewKey = JSON.stringify({ ...settled, statement: null });
  const preview = useApiLoad((client, signal) => previewNewsMail(client, settled, signal), previewKey);
  const teamsChosen = settled.audience.type === 'members' || settled.audience.teams.length > 0;
  const count = useApiLoad(
    (client, signal) => (teamsChosen ? fetchNewsCount(client, settled, signal) : Promise.resolve(null)),
    JSON.stringify({ slug: settled.slug, audience: settled.audience }),
  );
  const listsAllowed = sendAccess(roles).list;
  const lists = useApiLoad(
    (client, signal) => (draft.audience.type === 'teams' && listsAllowed ? fetchSendableLists(client, signal) : Promise.resolve([])),
    `news-teams:${draft.audience.type}:${listsAllowed}`,
  );
  const teams = useMemo(() => (lists.status === 'success' ? teamOptions(lists.data) : []), [lists]);

  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendProblem, setSendProblem] = useState<ReactNode>(null);

  if (preview.status === 'error' && preview.error.status === 404) {
    return (
      <StateCard icon={SearchX} title="Haber bulunamadı" description={preview.error.message}>
        <Link href={newsSendHref('')} className="text-skylab-300 text-sm hover:underline">
          Başka bir haber aç
        </Link>
      </StateCard>
    );
  }

  const currentCount = count.status === 'success' ? count.data : null;
  const problems = sendProblems(draft, currentCount);
  const stepIndex = preview.status !== 'success' ? 0 : !teamsChosen ? 1 : problems.length > 0 ? 3 : 5;

  async function sendTest() {
    setTesting(true);
    setTestNote(null);
    try {
      await testNewsMail(api, draft);
      setTestNote({ tone: 'success', text: 'Deneme postası kendi adresine gönderildi. Konusu “[Deneme]” ile başlar; birkaç dakika içinde gelir.' });
    } catch (error) {
      setTestNote({ tone: 'danger', text: apiErrorMessage(error) });
    } finally {
      setTesting(false);
    }
  }

  async function send() {
    setSending(true);
    setSendProblem(null);
    try {
      const result = await sendNews(api, draft);
      flashNotice(sendHref(result.id), {
        tone: 'success',
        text: `Haber ${formatCount(result.queued)} alıcıya gönderilmek üzere kuyruğa alındı.${result.counts.already_received > 0 ? ` Daha önce alan ${formatCount(result.counts.already_received)} kişi atlandı.` : ''}`,
      });
      router.push(sendHref(result.id));
    } catch (error) {
      const failure = asApiError(error);
      const existing = typeof failure.params?.task_id === 'string' ? failure.params.task_id : null;
      setSendProblem(
        existing ? (
          <>
            {failure.message}{' '}
            <Link href={sendHref(existing)} className="text-skylab-300 hover:underline">
              Gönderime git
            </Link>
          </>
        ) : (
          failure.message
        ),
      );
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Haberden gönder"
        description={preview.status === 'success' ? preview.data.subject : slug}
        actions={
          <Link href={SEND_LIST_PATH} className="text-sm text-subtle-foreground hover:underline">
            Gönderimlere dön
          </Link>
        }
      />
      <Stepper steps={STEPS} current={stepIndex} />

      <Step n={1} title="İçerik">
        <NewsPreview state={preview} />
      </Step>

      <Step n={2} title="Kitle">
        <SegmentedControl
          aria-label="Kitle"
          options={AUDIENCE_OPTIONS}
          value={draft.audience.type}
          onValueChange={(type) => set({ audience: { type: type === 'teams' ? 'teams' : 'members', teams: draft.audience.teams } })}
        />
        {draft.audience.type === 'teams' ? (
          listsAllowed ? (
            <MultiSelect
              aria-label="Ekipler"
              items={teams}
              value={draft.audience.teams}
              onValueChange={(next) => set({ audience: { type: 'teams', teams: next } })}
              placeholder={lists.status === 'loading' ? 'Ekipler yükleniyor…' : 'Ekip seç'}
              emptyText="Bu adla bir ekip yok."
            />
          ) : (
            <Notice tone="warning">Ekip listesini görmek için mail listelerini okuma yetkisi gerekiyor.</Notice>
          )
        ) : null}
        <p className="text-xs text-subtle-foreground">Ekip seçince alt ekipleri ve ekibi takip edenler de alır.</p>
        <LiveCount state={count} waiting={!teamsChosen} />
      </Step>

      <Step n={3} title="Biçim">
        <SegmentedControl aria-label="Biçim" options={FORMAT_OPTIONS} value={draft.format} onValueChange={(format) => set({ format: format as NewsFormat })} />
      </Step>

      <Step n={4} title="Konu ve önizleme metni">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            label="Konu"
            hint="Boş bırakılırsa haberin başlığı; duyuruda başına “Duyuru: ” gelir."
            value={draft.subject}
            maxLength={NEWS_SUBJECT_MAX}
            onChange={(event) => set({ subject: event.target.value })}
          />
          <FormField
            label="Önizleme metni"
            hint="Posta kutusunda konunun yanında görünür. Boş bırakılırsa haberin özeti."
            value={draft.preheader}
            maxLength={NEWS_PREHEADER_MAX}
            onChange={(event) => set({ preheader: event.target.value })}
          />
        </div>
      </Step>

      <Step n={5} title="Deneme postası">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" pending={testing} onClick={() => void sendTest()}>
            Kendime gönder
          </Button>
          <span className="text-xs text-subtle-foreground">Yalnız kendi doğrulanmış adresine gider; gönderime sayılmaz.</span>
        </div>
        {testNote ? <Notice tone={testNote.tone}>{testNote.text}</Notice> : null}
      </Step>

      <Step n={6} title="Gözden geçir">
        <Review draft={draft} count={currentCount} links={preview.status === 'success' ? mailLinks(preview.data.html) : []} />
        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={draft.statement}
            onChange={(event) => set({ statement: event.target.checked })}
            className="accent-skylab-500 mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
          />
          <span>{COMMERCIAL_STATEMENT}</span>
        </label>
        {problems.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-xs text-subtle-foreground">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
        {canSend ? (
          <Button variant="primary" pending={sending} disabled={problems.length > 0 || sending} onClick={() => void send()}>
            Şimdi gönder
          </Button>
        ) : (
          <Notice tone="info">
            Haberi doğrudan gönderme yetkin yok. Önizleme, deneme postası ve sayı açık; haberden gönderimi onaya sunma yolu henüz yok.
          </Notice>
        )}
        {sendProblem ? (
          <p role="alert" className="text-sm text-destructive">
            {sendProblem}
          </p>
        ) : null}
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`news-step-${n}`} className="space-y-3">
      <h2 id={`news-step-${n}`} className="text-sm font-medium text-foreground">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function NewsPreview({ state }: { state: ReturnType<typeof useApiLoad<import('@/lib/news-send').RenderedNewsMail>> }) {
  const [scheme, setScheme] = useState<MailScheme>('light');
  const [width, setWidth] = useState('desktop');
  if (state.status === 'error') {
    return <Notice tone="danger">{state.error.message}</Notice>;
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl aria-label="Önizleme genişliği" options={WIDTH_OPTIONS} value={width} onValueChange={setWidth} />
        <SchemeToggle value={scheme} onChange={setScheme} />
      </div>
      {state.status === 'success' ? (
        <p className="text-sm text-secondary-foreground">
          <span className="text-subtle-foreground">Konu: </span>
          {state.data.subject}
        </p>
      ) : null}
      <div className={width === 'mobile' ? 'mx-auto max-w-[375px]' : ''}>
        <MailFrame title="Haber postası önizlemesi" html={state.status === 'success' ? state.data.html : null} scheme={scheme} className="h-[60vh] min-h-[420px]" />
      </div>
      <p className="text-xs text-subtle-foreground">Sunucuda gerçek şablonla, seni alıcı sayarak hazırlandı. Alıcının adı ve çıkış bağlantısı her alıcı için doldurulur.</p>
    </div>
  );
}

function LiveCount({ state, waiting }: { state: ReturnType<typeof useApiLoad<import('@/lib/news-send').NewsSendCount | null>>; waiting: boolean }) {
  if (waiting) return <p className="text-xs text-subtle-foreground">Sayı için en az bir ekip seç.</p>;
  if (state.status === 'loading') return <p className="text-xs text-subtle-foreground">Alıcılar sayılıyor…</p>;
  if (state.status === 'error') return <Notice tone="danger">{state.error.message}</Notice>;
  if (!state.data) return null;
  const { counts } = state.data;
  const reach = Math.max(counts.total - counts.already_received, 0);
  return (
    <div className="space-y-2" aria-live="polite">
      <p className="text-sm text-foreground">
        <span className="font-medium tabular-nums">{formatCount(reach)}</span> kişiye gider
        {counts.already_received > 0 ? ` (${formatCount(counts.already_received)} kişi zaten aldı, atlanacak)` : ''}.
      </p>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle-foreground">
        {countParts(state.data).map((part) => (
          <div key={part.key} className="flex gap-1">
            <dt>{part.label}:</dt>
            <dd className="tabular-nums text-secondary-foreground">{formatCount(part.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Review({ draft, count, links }: { draft: NewsDraft; count: import('@/lib/news-send').NewsSendCount | null; links: string[] }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <Fact term="Kitle">{draft.audience.type === 'members' ? 'Tüm üyeler' : `${draft.audience.teams.length} ekip`}</Fact>
      <Fact term="Alıcı">{count ? formatCount(Math.max(count.counts.total - count.counts.already_received, 0)) : '—'}</Fact>
      <Fact term="Konu">{draft.subject.trim() || 'Haberin başlığı'}</Fact>
      <Fact term="Biçim">{draft.format === 'full' ? 'Tam metin' : 'Özet + bağlantı'}</Fact>
      <Fact term="Postadaki bağlantılar" wide>
        {links.length === 0 ? (
          '—'
        ) : (
          <ul className="space-y-0.5">
            {links.map((link) => (
              <li key={link} className="truncate font-mono text-2xs">
                {link}
              </li>
            ))}
          </ul>
        )}
      </Fact>
    </dl>
  );
}

function Fact({ term, children, wide = false }: { term: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-md border border-border-subtle bg-card px-3.5 py-3 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-2xs text-subtle-foreground">{term}</dt>
      <dd className="mt-1 min-w-0 text-secondary-foreground">{children}</dd>
    </div>
  );
}
