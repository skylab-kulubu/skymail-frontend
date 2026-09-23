'use client';

// A new send (ticket 16): a Mail template or a free announcement, to a
// mailing list or to people one by one, with the template's variables filled
// in and the mail previewed as it goes out. superadmin links an Event's list
// here as ?mail_list_id=<id>, and the list is preselected. Only a template's
// published version is ever sent; a free announcement's body is written in
// the Visual editor and still goes through the server's allow-list.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Lock, Send as SendIcon } from 'lucide-react';
import { FilterPills } from '@/components/chrome/FilterPills';
import { NoticeBox } from '@/components/chrome/Notice';
import { StateCard } from '@/components/chrome/StateCard';
import { Tag } from '@/components/chrome/Tag';
import { useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { Modal } from '@/components/ui/Modal';
import { ModalPrimaryActions } from '@/components/ui/modal-actions';
import { asApiError } from '@/lib/api/errors';
import { useApi, useApiLoad } from '@/lib/api/react';
import type { ListRow } from '@/lib/mailing-lists';
import { flashNotice } from '@/lib/notice';
import { SEND_LIST_PATH, formatCount, sendHref } from '@/lib/sends';
import { sendAccess, type SendAccess } from '@/lib/send-form/access';
import type { PersonRow } from '@/lib/send-form/audience';
import { fieldValues, variableFields, type FieldInput } from '@/lib/send-form/fields';
import {
  FREE_BODY_VARIABLE,
  NO_FREE_TEMPLATE,
  audienceSize,
  fetchSendableLists,
  fetchSendableTemplates,
  freeTemplate,
  previewValues,
  publishedOnlyNote,
  sendPlan,
  sendRefusal,
  sendToList,
  sendToPeople,
  templateChoices,
  whyNotFound,
  type PersonOutcome,
  type SendPlan,
  type SingleSendRequest,
} from '@/lib/send-form/send';
import type { MailTemplate } from '@/lib/templates';
import { ChoiceList } from './ChoiceList';
import { PeopleEditor } from './PeopleEditor';
import { PeopleSummary } from './PeopleSummary';
import { SendPreview } from './SendPreview';
import { VariableFields } from './VariableFields';

type What = 'template' | 'free';
type Audience = 'list' | 'people';

const WHAT_OPTIONS: ReadonlyArray<{ value: What; label: string }> = [
  { value: 'free', label: 'Serbest duyuru' },
  { value: 'template', label: 'Mail template' },
];

const AUDIENCE_OPTIONS: ReadonlyArray<{ value: Audience; label: string }> = [
  { value: 'list', label: 'Mail listesi' },
  { value: 'people', label: 'Kişiler' },
];

const TITLE = 'Yeni gönderim';

export function SendForm() {
  const { roles } = useConsole();
  const access = sendAccess(roles);
  if (access.blocked) {
    return (
      <div className="space-y-6">
        <PageHeader title={TITLE} />
        <StateCard Icon={Lock} tone="warning" title="Bu hesapla gönderim yapılamaz" description={access.blocked}>
          {access.detail ? (
            <Link href={SEND_LIST_PATH} className="text-skylab-300 text-sm hover:underline">
              Gönderimlere dön
            </Link>
          ) : null}
        </StateCard>
      </div>
    );
  }
  return <Catalog access={access} />;
}

/** The templates and lists to pick from, loaded once. */
function Catalog({ access }: { access: SendAccess }) {
  const catalog = useApiLoad(
    async (api, signal) => {
      const [templates, lists] = await Promise.all([
        fetchSendableTemplates(api, signal),
        access.list ? fetchSendableLists(api, signal) : Promise.resolve<ListRow[]>([]),
      ]);
      return { templates, lists };
    },
    access.list ? 'templates+lists' : 'templates',
  );
  if (catalog.status === 'loading') return <StateCard isLoading title="Template'ler ve listeler yükleniyor" />;
  if (catalog.status === 'error') {
    return (
      <StateCard Icon={AlertTriangle} tone="danger" title="Gönderim formu açılamadı" description={catalog.error.message}>
        <Button variant="secondary" onClick={() => void catalog.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }
  return <Compose access={access} templates={catalog.data.templates} lists={catalog.data.lists} />;
}

/** A part of the form, numbered as the sender goes through it. */
function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-sm font-medium text-neutral-100">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TemplateChoice({ template }: { template: MailTemplate }) {
  return (
    <span className="block min-w-0">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm break-words text-neutral-100">{template.name}</span>
        {template.system ? <Tag tone="system">System</Tag> : null}
      </span>
      {template.key ? (
        <span className="text-2xs mt-0.5 block font-mono break-all text-neutral-500">
          <span className="sr-only">Template key: </span>
          {template.key}
        </span>
      ) : null}
    </span>
  );
}

function ListChoice({ list }: { list: ListRow }) {
  return (
    <span className="block min-w-0">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm break-words text-neutral-100">{list.name}</span>
        {list.external ? <Tag tone="external">Harici</Tag> : null}
      </span>
      <span className="text-2xs mt-0.5 block break-all text-neutral-500">{list.external ? (list.groupPath ?? 'Keycloak grubu') : 'Internal liste'}</span>
    </span>
  );
}

/** How many a list sends to, said under it. */
function sizeText(list: ListRow, size: number | null | undefined, failed: boolean): string {
  if (failed) return 'Alıcı sayısı alınamadı.';
  if (size === undefined) return 'Alıcılar sayılıyor…';
  if (size === null) return '';
  return list.external
    ? `${formatCount(size)} üye. E-posta adresi olmayan üyeye gönderilmez.`
    : `${formatCount(size)} alıcı.`;
}

const EMPTY_PERSON: PersonRow = { name: '', email: '' };

/** The send being written, sent, or its people's outcome. */
function Compose({ access, templates, lists }: { access: SendAccess; templates: MailTemplate[]; lists: ListRow[] }) {
  const api = useApi();
  const router = useRouter();
  const presetListId = useSearchParams().get('mail_list_id');
  const preset = presetListId ? (lists.find((list) => list.id === presetListId) ?? null) : null;
  const free = freeTemplate(templates);
  const choices = useMemo(() => templateChoices(templates), [templates]);

  const [what, setWhat] = useState<What>(free ? 'free' : 'template');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [rich, setRich] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<Audience>(access.list ? 'list' : 'people');
  const [listId, setListId] = useState<string | null>(preset?.id ?? null);
  const [people, setPeople] = useState<PersonRow[]>([EMPTY_PERSON]);
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState<SendPlan | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const [result, setResult] = useState<{ what: string; requests: SingleSendRequest[]; outcomes: PersonOutcome[] } | null>(null);
  const refusalRef = useRef<HTMLDivElement>(null);

  const template = what === 'free' ? free : (choices.find((choice) => choice.id === templateId) ?? null);
  const fields = useMemo(() => (template ? variableFields(template) : []), [template]);
  const list = audience === 'list' ? (lists.find((candidate) => candidate.id === listId) ?? null) : null;
  const input: FieldInput = { values, rich };
  const draft = { what, template, fields: input, audience, list, people };
  const check = sendPlan(draft);
  const problems = attempted && !check.ok ? check.problems : null;
  const require = what === 'free' ? [FREE_BODY_VARIABLE] : [];

  const size = useApiLoad(
    (loader, signal) => (list ? audienceSize(loader, list, signal) : Promise.resolve(null)),
    list?.id ?? '',
  );

  // The preview fills the published body with what would go out now.
  const markup = fields.filter((field) => field.kind === 'rich').map((field) => field.name);
  const current = fieldValues(fields, input);
  const firstPerson = audience === 'people' ? (people.find((person) => person.email.trim() !== '') ?? null) : null;
  const sample = previewValues(current, firstPerson && { name: firstPerson.name.trim(), email: firstPerson.email.trim() }, markup);

  const whatLabel =
    what === 'free' ? `Serbest duyuru${current.Subject ? ` “${current.Subject}”` : ''}` : template ? `“${template.name}”` : '';

  function submit() {
    setAttempted(true);
    setRefusal(null);
    if (check.ok) setConfirming(check.plan);
  }

  async function send(plan: SendPlan) {
    if (plan.kind === 'list') {
      setProgress({ done: 0, total: 1 });
      try {
        const id = await sendToList(api, plan.request);
        const text = `Gönderim kuyruğa alındı: ${whatLabel}, “${list?.name ?? ''}” listesine.`;
        if (access.detail) {
          flashNotice(sendHref(id), { tone: 'success', text });
          router.push(sendHref(id));
          return;
        }
        setQueued(text);
      } catch (error) {
        const message =
          asApiError(error).status === 404
            ? await whyNotFound(api, { templateId: plan.request.template_id, list })
            : sendRefusal(error, 'list');
        setRefusal(message);
        requestAnimationFrame(() => refusalRef.current?.scrollIntoView({ block: 'center' }));
      }
      setProgress(null);
      setConfirming(null);
      return;
    }
    setProgress({ done: 0, total: plan.requests.length });
    const outcomes = await sendToPeople(api, plan.requests, (done) => setProgress({ done, total: plan.requests.length }));
    setProgress(null);
    setConfirming(null);
    setResult({ what: whatLabel, requests: plan.requests, outcomes });
  }

  async function retry() {
    if (!result) return;
    const failed = result.requests.filter((request) =>
      result.outcomes.some((outcome) => !outcome.ok && outcome.email === request.recipient_email),
    );
    setProgress({ done: 0, total: failed.length });
    const again = await sendToPeople(api, failed, (done) => setProgress({ done, total: failed.length }));
    setProgress(null);
    setResult({
      ...result,
      outcomes: result.outcomes.map((outcome) => again.find((next) => next.email === outcome.email) ?? outcome),
    });
  }

  function startOver() {
    setResult(null);
    setQueued(null);
    setPeople([EMPTY_PERSON]);
    setAttempted(false);
  }

  if (result) {
    return (
      <div className="space-y-6">
        <PageHeader title={TITLE} />
        <PeopleSummary
          what={result.what}
          outcomes={result.outcomes}
          canOpen={access.detail}
          retrying={progress}
          onRetry={() => void retry()}
          onNew={startOver}
        />
      </div>
    );
  }

  if (queued) {
    return (
      <div className="space-y-6">
        <PageHeader title={TITLE} />
        <StateCard Icon={CheckCircle2} tone="brand" title="Gönderim kuyruğa alındı" description={queued}>
          <Button variant="secondary" onClick={startOver}>
            Yeni gönderim
          </Button>
        </StateCard>
      </div>
    );
  }

  const draftNote = template ? publishedOnlyNote(template) : null;
  const pending = progress !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={TITLE}
        description="Bir Mail template'i ya da serbest bir duyuruyu bir mail listesine ya da tek tek kişilere gönder. Yalnız yayımlanmış sürüm gönderilir."
      />

      {presetListId && !preset ? (
        <NoticeBox tone="warning">
          {access.list
            ? 'Bağlantıdaki mail listesi bulunamadı: arşivlenmiş ya da artık yok. Aşağıdan bir liste seç.'
            : 'Bu bağlantı bir mail listesine gönderim için, ama bu hesap listeye gönderemez: kişileri aşağıda tek tek ekleyebilirsin.'}
        </NoticeBox>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Not a <form>: the Visual editor holds forms of its own (a link's address), and forms do not nest. */}
        <div className="min-w-0 space-y-8">
          <Part id="send-what" title="1. Ne gönderilecek">
            <FilterPills ariaLabel="Ne gönderilecek" value={what} onChange={setWhat} options={WHAT_OPTIONS} />
            {what === 'free' ? (
              free ? (
                <p className="text-xs text-neutral-500">
                  Serbest Gönderim template&apos;inin (<code>{free.key}</code>) yayımlanmış çerçevesiyle gider: konuyu, başlığı ve gövdeyi sen
                  yazarsın.
                </p>
              ) : (
                <NoticeBox tone="warning">{NO_FREE_TEMPLATE} Bir Mail template seçebilirsin.</NoticeBox>
              )
            ) : (
              <ChoiceList
                legend="Mail template"
                items={choices}
                value={templateId}
                onChange={setTemplateId}
                searchLabel="Template ara"
                searchText={(choice) => `${choice.name} ${choice.key ?? ''}`}
                render={(choice) => <TemplateChoice template={choice} />}
                empty="Gönderilebilecek bir Mail template yok."
                error={problems?.template}
              />
            )}
            {draftNote ? <NoticeBox tone="info">{draftNote}</NoticeBox> : null}
          </Part>

          <Part id="send-to" title="2. Kime">
            {access.list ? (
              <FilterPills ariaLabel="Kime" value={audience} onChange={setAudience} options={AUDIENCE_OPTIONS} />
            ) : (
              <NoticeBox tone="info">{access.listNote}</NoticeBox>
            )}
            {audience === 'list' ? (
              <>
                <ChoiceList
                  legend="Mail listesi"
                  items={lists}
                  value={listId}
                  onChange={setListId}
                  searchLabel="Liste ara"
                  searchText={(candidate) => `${candidate.name} ${candidate.groupPath ?? ''}`}
                  render={(candidate) => <ListChoice list={candidate} />}
                  empty="Gönderilebilecek bir mail listesi yok."
                  error={problems?.list}
                />
                {list ? (
                  <p className="text-xs text-neutral-400" aria-live="polite">
                    {sizeText(list, size.status === 'success' ? size.data : undefined, size.status === 'error')}
                  </p>
                ) : null}
              </>
            ) : (
              <PeopleEditor
                rows={people}
                onChange={setPeople}
                problems={problems?.people?.rows ?? null}
                none={problems?.people?.none ?? false}
              />
            )}
          </Part>

          {template ? (
            <Part id="send-fields" title={what === 'free' ? '3. Duyuru' : '3. Değişkenler'}>
              {fields.length === 0 ? (
                <p className="text-xs text-neutral-500">Bu template doldurulacak bir değişken kullanmıyor.</p>
              ) : (
                <VariableFields
                  fields={fields}
                  input={input}
                  onValue={(name, value) => setValues((previous) => ({ ...previous, [name]: value }))}
                  onRich={(name, source) => setRich((previous) => ({ ...previous, [name]: source }))}
                  problems={problems?.fields ?? null}
                  require={require}
                />
              )}
            </Part>
          ) : null}

          {attempted && !check.ok ? (
            <NoticeBox tone="error">Gönderim henüz gönderilemez: işaretli yerleri düzelt.</NoticeBox>
          ) : null}
          {refusal ? (
            <div ref={refusalRef}>
              <NoticeBox tone="error">
                <p className="font-medium">Gönderim açılamadı.</p>
                <p className="mt-1">{refusal}</p>
              </NoticeBox>
            </div>
          ) : null}

          <FormActions
            cancel={
              <Button variant="secondary" href={access.detail ? SEND_LIST_PATH : '/'} disabled={pending}>
                İptal
              </Button>
            }
            submit={
              <Button onClick={submit} disabled={pending}>
                <SendIcon className="h-4 w-4" aria-hidden />
                Gönder…
              </Button>
            }
          />
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <SendPreview template={template} sample={sample} />
        </aside>
      </div>

      <ConfirmSend
        plan={confirming}
        what={whatLabel}
        list={list}
        size={size.status === 'success' ? size.data : null}
        draftNote={draftNote}
        progress={progress}
        onCancel={() => setConfirming(null)}
        onConfirm={(plan) => void send(plan)}
      />
    </div>
  );
}

/** The last word before a send opens: what goes, to whom, how many. */
function ConfirmSend({
  plan,
  what,
  list,
  size,
  draftNote,
  progress,
  onCancel,
  onConfirm,
}: {
  plan: SendPlan | null;
  what: string;
  list: ListRow | null;
  size: number | null;
  draftNote: string | null;
  progress: { done: number; total: number } | null;
  onCancel: () => void;
  onConfirm: (plan: SendPlan) => void;
}) {
  const people = plan?.kind === 'people' ? plan.requests : [];
  const to =
    plan?.kind === 'list'
      ? `“${list?.name ?? ''}” listesi${size === null ? ' (alıcı sayısı bilinmiyor)' : list?.external ? ` (${formatCount(size)} üye)` : ` (${formatCount(size)} alıcı)`}`
      : `${formatCount(people.length)} kişi, her biri ayrı bir gönderim`;
  return (
    <Modal isOpen={plan !== null} onClose={progress ? () => {} : onCancel} title="Gönderimi onayla">
      <dl className="space-y-2">
        <div>
          <dt className="text-xs text-neutral-500">Gönderilecek</dt>
          <dd className="break-words text-neutral-100">{what}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Kime</dt>
          <dd className="break-words text-neutral-100">{to}</dd>
          {people.length > 0 ? (
            <dd className="mt-1 max-h-32 overflow-y-auto text-xs text-neutral-400">
              {people.map((request) => request.recipient_full_name || request.recipient_email).join(', ')}
            </dd>
          ) : null}
        </div>
      </dl>
      <p className="mt-3 text-xs text-neutral-500">
        {draftNote ?? 'Yalnız yayımlanmış sürüm gönderilir.'} Gönderim açıldıktan sonra geri alınamaz.
      </p>
      {progress && plan?.kind === 'people' ? (
        <p className="mt-3 text-xs text-neutral-300" role="status">
          Gönderiliyor: {progress.done}/{progress.total}
        </p>
      ) : null}
      <ModalPrimaryActions
        onCancel={onCancel}
        onConfirm={() => plan && onConfirm(plan)}
        confirmLabel="Gönder"
        pendingLabel="Gönderiliyor…"
        isPending={progress !== null}
      />
    </Modal>
  );
}
