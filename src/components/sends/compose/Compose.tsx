'use client';

// The send being written: what, to whom, the template's fields and the
// preview; then the confirmation, and what came of it (use-sending.ts).
// The rules — what keeps a send from going, what is only a warning, what
// may be sent again — are src/lib/send-form's.
//
// What the viewer may not send they submit for approval (ticket 20,
// use-submitting.ts): "Onaya sun" is the form's action for an audience they
// cannot send to, and beside "Gönder" for one they can, since anyone may
// submit — a list, or up to 100 people as one request (ticket 22). The same
// form resubmits a rejected or declined request, and starts a new one from
// an expired request, filled from it with every person (mail-approvals/edit.ts).

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, ClipboardCheck, Send as SendIcon } from 'lucide-react';
import { NoticeBox } from '@/components/chrome/Notice';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { useApiLoad } from '@/lib/api/react';
import { approvalHref, type MailApproval } from '@/lib/mail-approvals/approvals';
import { approvalRequest, type ComposePrefill } from '@/lib/mail-approvals/edit';
import { refusalNow, withRefusedRows } from '@/lib/mail-approvals/refusals';
import type { ListRow } from '@/lib/mailing-lists';
import { SEND_LIST_PATH, formatCount } from '@/lib/sends';
import { approvalNote, defaultAudience, directSend, type SendAccess } from '@/lib/send-form/access';
import { fieldValues, variableFields } from '@/lib/send-form/fields';
import {
  audienceSize,
  freeTemplate,
  previewValues,
  publishedOnlyNote,
  repeatsUncertainSend,
  retryOf,
  sendPlan,
  templateChoices,
} from '@/lib/send-form/send';
import type { MailTemplate } from '@/lib/templates';
import { AudiencePart, type Audience } from './AudiencePart';
import { ConfirmSend, type Confirming } from './ConfirmSend';
import { PeopleSummary } from './PeopleSummary';
import { personEntry, type PersonEntry } from './PeopleEditor';
import { SendPreview } from './SendPreview';
import { useSending } from './use-sending';
import { useSubmitting } from './use-submitting';
import { VariableFields } from './VariableFields';
import { WhatPart, type What } from './WhatPart';

export const SEND_FORM_TITLE = 'Yeni gönderim';

/**
 * What the form is for: a new send; a new one filled from a request for
 * approval (after it expired); or that request resubmitted, which only goes
 * for approval.
 */
export type ComposeMode =
  | { kind: 'new' }
  | { kind: 'copy'; approval: MailApproval }
  | { kind: 'resubmit'; approval: MailApproval };

const NEW: ComposeMode = { kind: 'new' };

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

export function Compose({
  access,
  templates,
  lists,
  mode = NEW,
  prefill = null,
  intro,
}: {
  access: SendAccess;
  templates: MailTemplate[];
  lists: ListRow[];
  mode?: ComposeMode;
  /** The form as a request for approval fills it. */
  prefill?: ComposePrefill | null;
  /** Said under the header: what the form was filled from, and why. */
  intro?: ReactNode;
}) {
  const presetListId = useSearchParams().get('mail_list_id');
  const preset = presetListId ? (lists.find((list) => list.id === presetListId) ?? null) : null;
  const free = freeTemplate(templates);
  const choices = useMemo(() => templateChoices(templates), [templates]);

  const [what, setWhat] = useState<What>(prefill?.what ?? (free ? 'free' : 'template'));
  const [templateId, setTemplateId] = useState<string | null>(prefill?.templateId ?? null);
  const [values, setValues] = useState<Record<string, string>>(prefill?.values ?? {});
  const [rich, setRich] = useState<Record<string, string>>(prefill?.rich ?? {});
  const [audience, setAudience] = useState<Audience>(prefill?.audience ?? defaultAudience(access, { presetList: presetListId !== null }));
  const [listId, setListId] = useState<string | null>(prefill ? prefill.listId : (preset?.id ?? null));
  const [people, setPeople] = useState<PersonEntry[]>(() =>
    prefill && prefill.people.length > 0 ? prefill.people.map((person) => personEntry(person)) : [personEntry()],
  );
  const [attempts, setAttempts] = useState(0);
  /** Whether the sender last asked to send, or to submit for approval. */
  const [intent, setIntent] = useState<'send' | 'submit'>('send');
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const sending = useSending({ canSeeSends: access.detail });
  const submitting = useSubmitting();
  const rootRef = useRef<HTMLDivElement>(null);
  const resubmit = mode.kind === 'resubmit' ? mode.approval : null;

  const template = what === 'free' ? free : (choices.find((choice) => choice.id === templateId) ?? null);
  const fields = useMemo(() => (template ? variableFields(template) : []), [template]);
  const list = audience === 'list' ? (lists.find((candidate) => candidate.id === listId) ?? null) : null;
  const input = { values, rich };
  const draft = { what, template, fields: input, audience, list, people };
  const check = sendPlan(draft);
  const problems = attempts > 0 && !check.ok ? check.problems : null;
  const held = repeatsUncertainSend(draft, sending.uncertain);

  const size = useApiLoad((loader, signal) => (list ? audienceSize(loader, list, signal) : Promise.resolve(null)), list?.id ?? '');
  const sizeKnown = size.status === 'success' ? size.data : size.status === 'error' ? null : undefined;

  // After a send that could not go, the first thing to fix gets the focus.
  useEffect(() => {
    if (attempts === 0) return;
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempts]);

  const current = fieldValues(fields, input);
  const firstPerson = audience === 'people' ? (people.find((person) => person.email.trim() !== '') ?? null) : null;
  const sample = previewValues(current, firstPerson && { name: firstPerson.name.trim(), email: firstPerson.email.trim() });
  const whatLabel =
    what === 'free' ? `Serbest duyuru${current.Subject ? ` “${current.Subject}”` : ''}` : template ? `“${template.name}”` : '';
  const draftNote = template ? publishedOnlyNote(template) : null;
  const busy = sending.progress !== null || submitting.busy;
  // A resubmission only goes for approval; anything else goes at once where the viewer may send it.
  const direct = !resubmit && directSend(access, audience);
  const forApproval = check.ok ? approvalRequest(check.plan, { lists: access.list }) : null;
  const approvalProblem = intent === 'submit' && attempts > 0 && forApproval && !forApproval.ok ? forApproval.problem : null;
  const audienceNote = approvalNote(access, audience, { resubmit: resubmit !== null });
  const refusal = submitting.failure ? refusalNow(submitting.failure, people) : null;

  function send() {
    if (busy || held) return;
    setIntent('send');
    setAttempts((count) => count + 1);
    if (check.ok) setConfirming({ kind: 'send', plan: check.plan });
  }

  function submitForApproval() {
    if (busy) return;
    setIntent('submit');
    setAttempts((count) => count + 1);
    if (!check.ok || !forApproval?.ok) return;
    // The API's last refusal, and the rows it marked, stand until another submission is on its way.
    submitting.clear();
    setConfirming({ kind: 'submit', plan: check.plan, request: forApproval.request, resubmit: resubmit !== null });
  }

  /** Enter in a field does what the form's first action does. */
  const submit = direct ? send : submitForApproval;

  /** Who it goes to, as the request's page says it. */
  function audienceWords(chosen: Extract<Confirming, { kind: 'submit' }>) {
    if (chosen.plan.kind === 'list') return `“${list?.name ?? ''}” listesine`;
    const { requests } = chosen.plan;
    return requests.length === 1 ? `${requests[0].recipient_email} adresine` : `${formatCount(requests.length)} kişiye`;
  }

  function resendList() {
    setAttempts((count) => count + 1);
    if (check.ok && check.plan.kind === 'list') setConfirming({ kind: 'resendList', plan: check.plan });
  }

  async function confirm(chosen: Confirming) {
    if (chosen.kind === 'submit') {
      const said = resubmit
        ? `Yeniden onaya sunuldu: ${whatLabel}, ${audienceWords(chosen)}. 7 günlük süre yeniden başladı.`
        : `Onaya sunuldu: ${whatLabel}, ${audienceWords(chosen)}. Bir onaycı onaylayınca gönderilir.`;
      const went = await submitting.submit(chosen.request, { resubmitId: resubmit?.id ?? null, said, people });
      if (!went) setConfirming(null);
      return;
    }
    if (chosen.kind === 'retryPeople') await sending.retryPeople(chosen.retry.requests);
    else if (chosen.plan.kind === 'list') await sending.toList(chosen.plan.request, list!, whatLabel);
    else await sending.toPeople(chosen.plan.requests, whatLabel);
    setConfirming(null);
  }

  function startOver() {
    sending.reset();
    setPeople([personEntry()]);
    setAttempts(0);
  }

  const dialog = (
    <ConfirmSend
      confirming={confirming}
      what={whatLabel}
      list={list}
      size={size.status === 'success' ? size.data : null}
      draftNote={draftNote}
      warnings={check.warnings.lines}
      progress={sending.progress}
      submitting={submitting.busy}
      onCancel={() => setConfirming(null)}
      onConfirm={(chosen) => void confirm(chosen)}
    />
  );

  if (sending.people) {
    const retry = retryOf(sending.people.requests, sending.people.outcomes);
    return (
      <div className="space-y-6">
        <PageHeader title={SEND_FORM_TITLE} />
        <PeopleSummary
          what={sending.people.what}
          outcomes={sending.people.outcomes}
          canOpen={access.detail}
          canRetry={retry.requests.length > 0}
          busy={busy}
          onRetry={() => setConfirming({ kind: 'retryPeople', retry })}
          onNew={startOver}
        />
        {dialog}
      </div>
    );
  }

  if (sending.queued) {
    return (
      <div className="space-y-6">
        <PageHeader title={SEND_FORM_TITLE} />
        <StateCard Icon={CheckCircle2} tone="brand" title="Gönderim kuyruğa alındı" description={sending.queued}>
          <Button variant="secondary" onClick={startOver}>
            Yeni gönderim
          </Button>
        </StateCard>
      </div>
    );
  }

  const failure = sending.listFailure;
  const sendsAnything = access.send.list || access.send.people;
  return (
    <div ref={rootRef} className="space-y-6">
      <PageHeader
        title={resubmit ? 'İsteği yeniden sun' : SEND_FORM_TITLE}
        description={
          resubmit
            ? "Değişkenleri, Mail template'i ya da kitleyi değiştirip yeniden onaya sun. Yeniden sunulan istek template'in şimdi yayımlanmış sürümüyle gider ve 7 günlük süre yeniden başlar."
            : sendsAnything
              ? "Bir Mail template'i ya da serbest bir duyuruyu bir mail listesine ya da tek tek kişilere gönder; gönderemediğini onaya sun. Yalnız yayımlanmış sürüm gönderilir."
              : "Bir Mail template'i ya da serbest bir duyuruyu onaya sun: bir onaycı onaylayınca gönderilir. Yalnız yayımlanmış sürüm gönderilir."
        }
      />

      {intro}

      {!prefill && presetListId && !preset ? (
        <NoticeBox tone="warning">
          {access.list
            ? 'Bağlantıdaki mail listesi bulunamadı: arşivlenmiş ya da artık yok. Aşağıdan bir liste seç.'
            : 'Bu bağlantı bir mail listesine gönderim için, ama bu hesap mail listelerini göremiyor (skymail:lists:read): kişileri aşağıda ekleyebilirsin.'}
        </NoticeBox>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Not a <form>: the Visual editor holds forms of its own (a link's address), and forms do not nest. */}
        <div className="min-w-0 space-y-8">
          <Part id="send-what" title="1. Ne gönderilecek">
            <WhatPart
              what={what}
              onWhat={setWhat}
              free={free}
              choices={choices}
              templateId={templateId}
              onTemplate={setTemplateId}
              problem={problems?.template ?? null}
              draftNote={draftNote}
            />
          </Part>

          <Part id="send-to" title="2. Kime">
            <AudiencePart
              access={access}
              audience={audience}
              onAudience={setAudience}
              lists={lists}
              listId={listId}
              onList={setListId}
              list={list}
              size={sizeKnown}
              listProblem={problems?.list ?? null}
              people={people}
              onPeople={setPeople}
              peopleCheck={withRefusedRows(problems?.people ?? null, refusal?.rows ?? null)}
              peopleWarnings={check.warnings.people}
              onSend={submit}
            />
            {audienceNote ? <NoticeBox tone="info">{audienceNote}</NoticeBox> : null}
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
                  warnings={check.warnings.fields}
                  onSend={submit}
                />
              )}
            </Part>
          ) : null}

          {problems ? (
            <NoticeBox tone="error">
              {intent === 'submit' ? 'Gönderim henüz onaya sunulamaz: işaretli yerleri düzelt.' : 'Gönderim henüz gönderilemez: işaretli yerleri düzelt.'}
            </NoticeBox>
          ) : null}
          {approvalProblem ? <NoticeBox tone="error">{approvalProblem}</NoticeBox> : null}
          {refusal ? (
            <NoticeBox tone="error">
              <p className="font-medium">{resubmit ? 'İstek yeniden onaya sunulamadı.' : 'Gönderim onaya sunulamadı.'}</p>
              <p className="mt-1">{refusal.text}</p>
            </NoticeBox>
          ) : null}
          {failure && held ? (
            <NoticeBox tone="warning">
              <p className="font-medium">Bu listeye gönderim açılmış olabilir.</p>
              <p className="mt-1">{failure.reason}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={resendList} disabled={busy}>
                  Yine de yeniden gönder…
                </Button>
                {access.detail ? (
                  <a href={SEND_LIST_PATH} target="_blank" rel="noopener" className="text-skylab-300 text-xs hover:underline">
                    Gönderimleri yeni sekmede aç
                  </a>
                ) : null}
              </div>
            </NoticeBox>
          ) : failure && failure.kind !== 'uncertain' ? (
            <NoticeBox tone={failure.kind === 'final' ? 'error' : 'warning'}>
              <p className="font-medium">Gönderim açılmadı.</p>
              <p className="mt-1">{failure.reason}</p>
            </NoticeBox>
          ) : null}

          <FormActions
            cancel={
              <Button
                variant="secondary"
                href={mode.kind === 'new' ? (access.detail ? SEND_LIST_PATH : '/') : approvalHref(mode.approval.id)}
                disabled={busy}
              >
                İptal
              </Button>
            }
            submit={
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={direct ? 'secondary' : 'primary'} onClick={submitForApproval} disabled={busy}>
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                  {resubmit ? 'Yeniden onaya sun…' : 'Onaya sun…'}
                </Button>
                {direct ? (
                  <Button onClick={send} disabled={busy || held} title={held ? 'Önce yeniden göndermeyi onayla' : undefined}>
                    <SendIcon className="h-4 w-4" aria-hidden />
                    Gönder…
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <SendPreview template={template} sample={sample} />
        </aside>
      </div>

      {dialog}
    </div>
  );
}
