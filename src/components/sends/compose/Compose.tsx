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
import { Button, Notice, StateCard } from '@skylab-kulubu/skylcn-ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { FormActions } from '@/components/common/FormActions';
import { useApiLoad } from '@/lib/api/react';
import { approvalHref, type MailApproval } from '@/lib/mail-approvals/approvals';
import { approvalRequest, type ComposePrefill } from '@/lib/mail-approvals/edit';
import { refusalNow, withRefusedRows } from '@/lib/mail-approvals/refusals';
import type { ListRow } from '@/lib/mailing-lists';
import { SEND_LIST_PATH, formatCount } from '@/lib/sends';
import { approvalNote, directSend, formAudience, pinAudience, type SendAccess } from '@/lib/send-form/access';
import { fieldValues, variableFields } from '@/lib/send-form/fields';
import {
  audienceSize,
  freeTemplate,
  previewValues,
  publishedOnlyNote,
  repeatsUncertainSend,
  retryOf,
  sampleRecipientName,
  sendPlan,
  templateChoices,
} from '@/lib/send-form/send';
import {
  TRACKING_LABEL,
  TRACKING_UNKNOWN,
  fetchTrackingMode,
  peopleTrackingDropped,
  templateTrackable,
  trackingAsked,
  trackingOffered,
} from '@/lib/send-form/tracking';
import { CATEGORY_REFUSALS, PURPOSE_START, purposeFields, purposeProblem, type PurposeChoice } from '@/lib/send-form/purpose';
import { requestTeams, teamsWords, type TeamAudience } from '@/lib/send-form/teams';
import type { MailTemplate } from '@/lib/templates';
import { AudiencePart, type Audience } from './AudiencePart';
import { ConfirmSend, confirmedSend, type Confirming } from './ConfirmSend';
import { PeopleSummary } from './PeopleSummary';
import { PurposePart } from './PurposePart';
import { personEntry, type PersonEntry } from './PeopleEditor';
import { SendPreview } from './SendPreview';
import { useSending } from './use-sending';
import { useSubmitting } from './use-submitting';
import { VariableFields } from './VariableFields';
import { WhatPart, type What } from './WhatPart';
import { NavButton } from '@/components/common/NavButton';
import { TeamPurpose } from './TeamPicker';
import { TEAM_SEAT_SEND_LABEL } from '@/lib/chrome-breadcrumbs';

export const SEND_FORM_TITLE = 'Yeni gönderim';


const NO_TEAMS: readonly TeamAudience[] = [];

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
      <h2 id={id} className="text-sm font-medium text-foreground">
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
  legacyForms = false,
  teams = NO_TEAMS,
  teamSeat = false,
  onTeamsRefused,
  teamsUnavailable = null,
}: {
  access: SendAccess;
  templates: MailTemplate[];
  lists: ListRow[];
  mode?: ComposeMode;
  /** The form as a request for approval fills it. */
  prefill?: ComposePrefill | null;
  /** Said under the header: what the form was filled from, and why. */
  intro?: ReactNode;
  /** The people came from a legacy Forms transfer (Eski aktarım): sent at once only as a Forms source is (directSend). */
  legacyForms?: boolean;
  /** The Teams the viewer leads (ekip-postasi 05): Ekibim is offered while there are any. */
  teams?: readonly TeamAudience[];
  /** A Leader without skymail:access: Ekibim only, a free announcement only (ekip-postasi 06). */
  teamSeat?: boolean;
  /** The API said the viewer no longer leads some Teams picked: read the Teams again. */
  onTeamsRefused?: () => void;
  /** Why the Teams could not be read (core did not answer): said under the audience. */
  teamsUnavailable?: string | null;
}) {
  const presetListId = useSearchParams().get('mail_list_id');
  const preset = presetListId ? (lists.find((list) => list.id === presetListId) ?? null) : null;
  const free = freeTemplate(templates);
  const choices = useMemo(() => templateChoices(templates), [templates]);

  const [what, setWhat] = useState<What>(teamSeat ? 'free' : (prefill?.what ?? (free ? 'free' : 'template')));
  const [templateId, setTemplateId] = useState<string | null>(prefill?.templateId ?? null);
  const [values, setValues] = useState<Record<string, string>>(prefill?.values ?? {});
  const [rich, setRich] = useState<Record<string, string>>(prefill?.rich ?? {});
  // The audience the sender (or the request) chose; until then, and for Teams with none to pick, where the form starts.
  // The Teams load beside the form: Ekibim becomes the start once they come, unless the sender chose already.
  const [chosenAudience, setAudience] = useState<Audience | null>(prefill?.audience ?? null);
  const audience: Audience = formAudience(chosenAudience, { access, presetList: presetListId !== null, teams: teams.length, teamSeat });
  // The Teams picked as the sender picked them; a Sub-team under a picked Team is dropped when the request is made.
  // Until the sender picks, one Team is picked for a Leader of one.
  const [picked, setPickedTeams] = useState<Set<string> | null>(() => (prefill?.teamIds ? new Set(prefill.teamIds) : null));
  const pickedTeams = useMemo(() => picked ?? new Set(teams.length === 1 ? [teams[0].id] : []), [picked, teams]);
  const [listId, setListId] = useState<string | null>(prefill ? prefill.listId : (preset?.id ?? null));
  const [people, setPeople] = useState<PersonEntry[]>(() =>
    prefill && prefill.people.length > 0 ? prefill.people.map((person) => personEntry(person)) : [personEntry()],
  );
  /** The tracking box; it counts only while the form offers it. */
  const [trackingTicked, setTrackingTicked] = useState(prefill?.tracking ?? false);
  /** The purpose, category and statements; sent only while the backend takes a purpose. */
  const [purposeChoice, setPurposeChoice] = useState<PurposeChoice>(prefill?.purpose ?? PURPOSE_START);
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
  const team = audience === 'team';
  const chosenTeams = useMemo(() => requestTeams(pickedTeams, teams), [pickedTeams, teams]);
  const input = { values, rich };
  const formSource = prefill?.formSource ?? null;
  // While the mode loads or fails, the box stays hidden. While SkyMail tracks every send
  // (tracking_always) there is no box: every list and people send asks, and the confirmation says so.
  const trackingState = useApiLoad(
    (loader, signal) => fetchTrackingMode(loader, { canReadSummary: access.detail, signal }),
    `tracking-mode:${access.detail}`,
  );
  const trackingMode = trackingState.status === 'success' ? trackingState.data : TRACKING_UNKNOWN;
  const trackingShown = trackingOffered({ ...trackingMode, audience, template });
  const tracking = trackingAsked({ mode: trackingMode, audience, template, ticked: trackingTicked });
  // A template that may not be tracked to this audience clears the box: going back to one that may does not tick it again.
  const untrackable = template !== null && audience !== 'form' && audience !== 'team' && !templateTrackable(template, audience);
  useEffect(() => {
    if (untrackable) setTrackingTicked(false);
  }, [untrackable]);
  // With an older backend, or SKYMAIL_MAIL_PURPOSE off, the form says and sends nothing of it.
  // Team mail's purpose is the server's, always shown fixed; only its statement is the sender's.
  const purposeShown = trackingMode.purpose && !team;
  const purpose = purposeShown ? purposeFields(purposeChoice, audience, list, trackingMode.listConsent) : null;
  const purposeBlock = team
    ? purposeChoice.commercialAbsent
      ? null
      : 'Tanıtım beyanını işaretle.'
    : purposeShown
      ? purposeProblem(purposeChoice, audience, list)
      : null;
  const draft = { what, template, fields: input, audience, list, people, formSource, tracking, purpose, teams: chosenTeams };
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
  const previewRecipient = firstPerson && { name: firstPerson.name.trim(), email: firstPerson.email.trim() };
  const sample = previewValues(current, previewRecipient, fields);
  const whatLabel =
    what === 'free' ? `Serbest duyuru${current.Subject ? ` “${current.Subject}”` : ''}` : template ? `“${template.name}”` : '';
  const draftNote = template ? publishedOnlyNote(template) : null;
  const busy = sending.progress !== null || submitting.busy;
  // A resubmission only goes for approval; anything else goes at once where the viewer may send it.
  const direct = !resubmit && directSend(access, audience, { legacyForms });
  const forApproval = check.ok ? approvalRequest(check.plan, { lists: access.list }) : null;
  const approvalProblem = intent === 'submit' && attempts > 0 && forApproval && !forApproval.ok ? forApproval.problem : null;
  const audienceNote = approvalNote(access, audience, { resubmit: resubmit !== null, legacyForms });
  const refusal = submitting.failure ? refusalNow(submitting.failure, people) : null;
  // Teams the API says the viewer does not lead now leave the picker, and the Teams are read again.
  const refusedTeams = submitting.failure?.teamIds;
  const teamsRefused = useRef(onTeamsRefused);
  const pickedNow = useRef(pickedTeams);
  useEffect(() => {
    teamsRefused.current = onTeamsRefused;
    pickedNow.current = pickedTeams;
  });
  useEffect(() => {
    if (!refusedTeams || refusedTeams.length === 0) return;
    const gone = new Set(refusedTeams.map((id) => id.toLowerCase()));
    setPickedTeams(new Set([...pickedNow.current].filter((id) => !gone.has(id.toLowerCase()))));
    teamsRefused.current?.();
  }, [refusedTeams]);
  // A refused category is said under the picker, whichever action it came from.
  const categoryRefusal = (code: string | undefined, text: string) => (code && CATEGORY_REFUSALS.has(code) ? text : null);
  const categoryProblem =
    (sending.listFailure && categoryRefusal(sending.listFailure.code, sending.listFailure.reason)) ??
    (submitting.failure && categoryRefusal(submitting.failure.code, submitting.failure.text)) ??
    null;
  // Why the actions do not go, beside them as well as on hover.
  const sendBlock = held ? 'Önce yeniden göndermeyi onayla.' : purposeBlock;

  function send() {
    if (busy || held) return;
    setIntent('send');
    setAttempts((count) => count + 1);
    if (check.ok && !purposeBlock) setConfirming({ kind: 'send', plan: check.plan, list, what: whatLabel });
  }

  function submitForApproval() {
    if (busy) return;
    setIntent('submit');
    setAttempts((count) => count + 1);
    if (!check.ok || !forApproval?.ok || purposeBlock) return;
    // The API's last refusal, and the rows it marked, stand until another submission is on its way.
    submitting.clear();
    setConfirming({ kind: 'submit', plan: check.plan, request: forApproval.request, resubmit: resubmit !== null, list, what: whatLabel });
  }

  /** Enter in a field does what the form's first action does. */
  const submit = direct ? send : submitForApproval;

  /** Who it goes to, as the request's page says it. */
  function audienceWords(chosen: Extract<Confirming, { kind: 'submit' }>) {
    if (chosen.plan.kind === 'list') return `“${chosen.list?.name ?? ''}” listesine`;
    if (chosen.plan.kind === 'team') return teamsWords(chosen.plan.teams);
    if (chosen.plan.kind === 'form') return `“${chosen.plan.source.form_title}” formunun ${formatCount(chosen.plan.source.recipient_count)} yanıtlayanına`;
    const { requests } = chosen.plan;
    return requests.length === 1 ? `${requests[0].recipient_email} adresine` : `${formatCount(requests.length)} kişiye`;
  }

  function resendList() {
    setAttempts((count) => count + 1);
    if (check.ok && check.plan.kind === 'list' && list) setConfirming({ kind: 'resendList', plan: check.plan, list, what: whatLabel });
  }

  async function confirm(chosen: Confirming) {
    if (chosen.kind === 'submit') {
      const said = resubmit
        ? `Yeniden onaya sunuldu: ${chosen.what}, ${audienceWords(chosen)}. 7 günlük süre yeniden başladı.`
        : `Onaya sunuldu: ${chosen.what}, ${audienceWords(chosen)}. Bir onaycı onaylayınca gönderilir.`;
      const went = await submitting.submit(chosen.request, { resubmitId: resubmit?.id ?? null, said, people });
      if (!went) setConfirming(null);
      return;
    }
    // The send the dialog opened with: a list or audience changed behind it does not reach it.
    const action = confirmedSend(chosen);
    if (action?.kind === 'retry') await sending.retryPeople(action.requests);
    else if (action?.kind === 'list') await sending.toList(action.request, action.list, action.what);
    else if (action?.kind === 'form') await sending.toFormSource(action.request, action.formTitle, action.what);
    else if (action?.kind === 'people') await sending.toPeople(action.requests, action.what);
    setConfirming(null);
  }

  function startOver() {
    if (audience === 'form') {
      window.location.assign(access.detail ? SEND_LIST_PATH : '/');
      return;
    }
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
      trackingAlways={trackingMode.available && trackingMode.always}
      listConsent={trackingMode.listConsent}
      teams={lists}
      teamsText={confirming && 'plan' in confirming && confirming.plan.kind === 'team' ? teamsWords(confirming.plan.teams) : null}
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
          trackingNote={peopleTrackingDropped(sending.people.requests, sending.people.outcomes)}
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
        <StateCard icon={CheckCircle2} tone="brand" title="Gönderim kuyruğa alındı" description={sending.queued}>
          <Button variant="outline" onClick={startOver}>
            Yeni gönderim
          </Button>
        </StateCard>
      </div>
    );
  }

  const failure = sending.listFailure;
  const sendsAnything = access.send.list || access.send.people;
  // The team seat writes a free announcement only: no template to pick.
  const number = (part: number) => (teamSeat ? part - 1 : part);
  return (
    <div ref={rootRef} className="space-y-6">
      <PageHeader
        title={resubmit ? 'İsteği yeniden sun' : teamSeat ? TEAM_SEAT_SEND_LABEL : SEND_FORM_TITLE}
        description={
          teamSeat
            ? resubmit
              ? 'Duyuruyu ya da ekipleri değiştirip yeniden onaya sun; 7 günlük süre yeniden başlar.'
              : 'Ekiplerine bir duyuru yaz ve onaya sun: bir onaycı onaylayınca ekip üyelerine gider.'
            : resubmit
            ? audience === 'form'
              ? "Mail template'ini ve içeriği düzenleyip aynı sabit Forms alıcılarıyla yeniden onaya sun. Alıcıları yenilemek için Forms'tan yeni bir istek hazırla."
              : "Değişkenleri, Mail template'i ya da kitleyi değiştirip yeniden onaya sun. Yeniden sunulan istek template'in şimdi yayımlanmış sürümüyle gider ve 7 günlük süre yeniden başlar."
            : sendsAnything
              ? "Bir Mail template'i ya da serbest bir duyuruyu bir mail listesine ya da tek tek kişilere gönder; gönderemediğini onaya sun. Yalnız yayımlanmış sürüm gönderilir."
              : "Bir Mail template'i ya da serbest bir duyuruyu onaya sun: bir onaycı onaylayınca gönderilir. Yalnız yayımlanmış sürüm gönderilir."
        }
      />

      {intro}

      {!teamSeat && !prefill && presetListId && !preset ? (
        <Notice tone="warning">
          {access.list
            ? 'Bağlantıdaki mail listesi bulunamadı: arşivlenmiş ya da artık yok. Aşağıdan bir liste seç.'
            : 'Bu bağlantı bir mail listesine gönderim için, ama bu hesap mail listelerini göremez: kişileri aşağıda ekleyebilirsin.'}
        </Notice>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Not a <form>: the Visual editor holds forms of its own (a link's address), and forms do not nest. */}
        <div className="min-w-0 space-y-8">
          {teamSeat ? (
            free ? null : <Notice tone="warning">{problems?.template ?? 'Serbest duyuru şu an hazırlanamıyor: çerçevesi SkyMail\'de yok.'}</Notice>
          ) : (
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
          )}

          <Part id="send-to" title={`${number(2)}. Kime`}>
            <AudiencePart
              access={access}
              audience={audience}
              onAudience={setAudience}
              lists={lists}
              listId={listId}
              onList={(id) => {
                // The sender chose: Teams arriving later no longer move the audience.
                setAudience(pinAudience(chosenAudience, audience));
                setListId(id);
              }}
              list={list}
              size={sizeKnown}
              listProblem={problems?.list ?? null}
              people={people}
              onPeople={(rows) => {
                setAudience(pinAudience(chosenAudience, audience));
                setPeople(rows);
              }}
              peopleCheck={withRefusedRows(problems?.people ?? null, refusal?.rows ?? null)}
              peopleWarnings={check.warnings.people}
              onSend={submit}
              formSource={formSource}
              teams={teams}
              pickedTeams={pickedTeams}
              onPickedTeams={setPickedTeams}
              teamsProblem={problems?.teams ?? null}
              disabled={busy}
            />
            {audienceNote ? <Notice tone="info">{audienceNote}</Notice> : null}
            {teamsUnavailable && teams.length === 0 ? <Notice tone="warning">{teamsUnavailable}</Notice> : null}
            {team ? (
              <TeamPurpose
                commercialAbsent={purposeChoice.commercialAbsent}
                onCommercialAbsent={(checked) => setPurposeChoice((previous) => ({ ...previous, commercialAbsent: checked }))}
                problem={attempts > 0 ? purposeBlock : null}
                disabled={busy}
                addressesNote={!access.list}
              />
            ) : purposeShown ? (
              <PurposePart
                choice={purposeChoice}
                onChoice={setPurposeChoice}
                audience={audience}
                list={list}
                lists={lists}
                categoryProblem={categoryProblem}
                listConsent={trackingMode.listConsent}
                problem={attempts > 0 ? purposeBlock : null}
                disabled={busy}
              />
            ) : null}
            {trackingShown ? (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={trackingTicked}
                  onChange={(event) => setTrackingTicked(event.target.checked)}
                  disabled={busy}
                  className="accent-skylab-500 h-4 w-4 shrink-0 cursor-pointer"
                />
                {TRACKING_LABEL}
              </label>
            ) : null}
          </Part>

          {template ? (
            <Part id="send-fields" title={what === 'free' ? `${number(3)}. Duyuru` : `${number(3)}. Değişkenler`}>
              {fields.length === 0 ? (
                <p className="text-xs text-subtle-foreground">Bu template doldurulacak bir değişken kullanmıyor.</p>
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
            <Notice tone="danger">
              {intent === 'submit' ? 'Gönderim henüz onaya sunulamaz: işaretli yerleri düzelt.' : 'Gönderim henüz gönderilemez: işaretli yerleri düzelt.'}
            </Notice>
          ) : null}
          {approvalProblem ? <Notice tone="danger">{approvalProblem}</Notice> : null}
          {refusal ? (
            <Notice tone="danger">
              <p className="font-medium">{resubmit ? 'İstek yeniden onaya sunulamadı.' : 'Gönderim onaya sunulamadı.'}</p>
              <p className="mt-1">{refusal.text}</p>
            </Notice>
          ) : null}
          {failure && held ? (
            <Notice tone="warning">
              <p className="font-medium">Bu listeye gönderim açılmış olabilir.</p>
              <p className="mt-1">{failure.reason}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={resendList} disabled={busy}>
                  Yine de yeniden gönder…
                </Button>
                {access.detail ? (
                  <a href={SEND_LIST_PATH} target="_blank" rel="noopener" className="text-skylab-300 text-xs hover:underline">
                    Gönderimleri yeni sekmede aç
                  </a>
                ) : null}
              </div>
            </Notice>
          ) : failure && audience === 'form' && failure.kind === 'uncertain' ? (
            <Notice tone="warning"><p className="font-medium">Gönderimin sonucu henüz bilinmiyor.</p><p className="mt-1">{failure.reason}</p></Notice>
          ) : failure && failure.kind !== 'uncertain' ? (
            <Notice tone={failure.kind === 'final' ? 'danger' : 'warning'}>
              <p className="font-medium">Gönderim açılmadı.</p>
              <p className="mt-1">{failure.reason}</p>
            </Notice>
          ) : null}

          <FormActions
            cancel={
              <NavButton
                variant="outline"
                href={mode.kind === 'new' ? (access.detail && !teamSeat ? SEND_LIST_PATH : '/') : approvalHref(mode.approval.id)}
                disabled={busy}
              >
                İptal
              </NavButton>
            }
            submit={
              <div className="flex flex-wrap items-center gap-2">
                {purposeBlock || (direct && held) ? (
                  <p id="send-blocked" className="text-xs text-subtle-foreground">
                    {direct ? sendBlock : purposeBlock}
                  </p>
                ) : null}
                <Button
                  variant={direct ? 'outline' : 'primary'}
                  onClick={submitForApproval}
                  disabled={busy || purposeBlock !== null}
                  title={purposeBlock ?? undefined}
                  aria-describedby={purposeBlock ? 'send-blocked' : undefined}
                >
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                  {resubmit ? 'Yeniden onaya sun…' : 'Onaya sun…'}
                </Button>
                {direct ? (
                  <Button
                    variant="primary"
                    onClick={send}
                    disabled={busy || held || purposeBlock !== null}
                    title={sendBlock ?? undefined}
                    aria-describedby={sendBlock ? 'send-blocked' : undefined}
                  >
                    <SendIcon className="h-4 w-4" aria-hidden />
                    Gönder…
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <SendPreview template={template} sample={sample} sampleName={sampleRecipientName(previewRecipient)} />
        </aside>
      </div>

      {dialog}
    </div>
  );
}
