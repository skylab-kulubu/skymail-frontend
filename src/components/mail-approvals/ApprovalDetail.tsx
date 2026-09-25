'use client';

// One request for approval (ticket 20), where the approval mails link
// (`/mail-approvals/show/:id`, `#preview` for its preview): the mail as it
// would go out, rendered by the server and shown only in a sandboxed frame,
// in both mail themes; its subject, audience, variables and deadline; what
// happened to it; and what the viewer can do with it now — decide it, as an
// approver, or answer it, as its submitter (mail-approvals/actions.ts). A
// request to several people lists them, and once approved links each to
// their own send (ticket 22).

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, SearchX } from 'lucide-react';
import { Notice, NoticeBox } from '@/components/chrome/Notice';
import { StateCard } from '@/components/chrome/StateCard';
import { useCan, useConsole } from '@/components/layout/ConsoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { MailFrame, SchemeToggle } from '@/components/mail-preview/MailPreview';
import type { MailScheme } from '@/components/mail-preview/preview-document';
import { Audience } from '@/components/sends/Audience';
import { SectionTitle } from '@/components/sends/SectionTitle';
import { VariableFields } from '@/components/sends/compose/VariableFields';
import { Button } from '@/components/ui/Button';
import { ROLE } from '@/lib/access';
import { useApi, useApiLoad } from '@/lib/api/react';
import { approvalViewer, viewerActions, type ViewerActions } from '@/lib/mail-approvals/actions';
import { formatClubTime } from '@/lib/format';
import {
  APPROVAL_LIST_PATH,
  approvalAudience,
  approvalHref,
  approvalPeople,
  approvalSends,
  copyApprovalHref,
  deadlineHint,
  eventActorName,
  fetchApproval,
  notificationNote,
  previewFailureNote,
  previewNote,
  previewRecipient,
  RECIPIENTS_ANCHOR,
  recipientName,
  resubmitHref,
  submitterName,
  type MailApproval,
} from '@/lib/mail-approvals/approvals';
import { approvalsChanged } from '@/lib/mail-approvals/changes';
import { DECISIONS, decisionBody, type Decision } from '@/lib/mail-approvals/decisions';
import {
  approvalFields,
  editedVariables,
  fetchPinnedSource,
  inputFromVariables,
  valueText,
  valuesBeforeEdit,
  type PinnedSource,
} from '@/lib/mail-approvals/edit';
import { approvalRefusal } from '@/lib/mail-approvals/refusals';
import { useFlashNotice, type NoticeData } from '@/lib/notice';
import { fieldWarnings, type FieldInput, type VariableField } from '@/lib/send-form/fields';
import { formatCount, sendHref } from '@/lib/sends';
import { ApprovalStateBadge, Deadline, SendsLink, Submitter } from './ApprovalParts';
import { ApprovalHistory } from './ApprovalHistory';
import { DecisionDialog } from './DecisionDialog';
import { EditComparison } from './EditComparison';

/** How many of a request's people the facts name before "+N kişi"; all of them are listed below. */
const PEOPLE_NAMED = 3;

export function ApprovalDetail({ id }: { id: string }) {
  const approval = useApiLoad((api, signal) => fetchApproval(api, id, signal), id);
  // The send form leaves one here when it submits.
  const [notice, setNotice] = useFlashNotice(approvalHref(id));

  if (approval.status === 'loading') return <StateCard isLoading title="İstek yükleniyor" />;
  if (approval.status === 'error') {
    return approval.error.status === 404 ? (
      <StateCard Icon={SearchX} title="İstek bulunamadı" description="Bu adreste bir onay isteği yok ya da görme yetkin yok: bir isteği yalnız sunan ve onaycılar görür.">
        <Link href={APPROVAL_LIST_PATH} className="text-skylab-300 text-sm hover:underline">
          Mail onaylarına dön
        </Link>
      </StateCard>
    ) : (
      <StateCard Icon={AlertTriangle} tone="danger" title="İstek yüklenemedi" description={approval.error.message}>
        <Button variant="secondary" onClick={() => void approval.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }
  return <ApprovalView approval={approval.data} reload={approval.reload} notice={notice} setNotice={setNotice} />;
}

type Editing = Readonly<{ initial: FieldInput; current: FieldInput; inexact: string[] }>;

function ApprovalView({
  approval,
  reload,
  notice,
  setNotice,
}: {
  approval: MailApproval;
  reload: () => Promise<void>;
  notice: NoticeData | null;
  setNotice: (notice: NoticeData | null) => void;
}) {
  const api = useApi();
  const { roles, user } = useConsole();
  const canReadTemplates = useCan(ROLE.templatesRead);
  const viewer = approvalViewer(roles, user);
  const now = new Date();
  const actions = viewerActions(approval, viewer, now);

  // The version the request is pinned to: its fields, and the mail side by side.
  const pinned = useApiLoad(
    (client, signal) => (canReadTemplates ? fetchPinnedSource(client, approval.template, signal) : Promise.resolve(null)),
    `${canReadTemplates}:${approval.template.id}:${approval.template.version_id}`,
  );
  const pinnedSource: PinnedSource = !canReadTemplates
    ? { status: 'noRole' }
    : pinned.status === 'loading'
      ? { status: 'loading' }
      : pinned.status === 'success' && pinned.data
        ? { status: 'ready', source: pinned.data }
        : { status: 'unreadable' };
  const source = pinnedSource.status === 'ready' ? pinnedSource.source : null;
  const fields = useMemo(() => approvalFields(source, approval.body_variables, approval.template.key), [source, approval]);

  const [started, setEditing] = useState<Editing | null>(null);
  // An edit shows only while the request can still be edited: one that moved on under it (reloaded after a refusal) drops it.
  const editing = started && actions.actions.includes('edit') ? started : null;
  const [tried, setTried] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);

  const recipient = previewRecipient(approval);
  const edit = editing ? editedVariables(fields, approval.body_variables, editing.initial, editing.current) : null;

  // The approval mails link to #preview; the page draws it once the request has
  // loaded, then takes the reader — and the focus, for a keyboard or a screen reader — there.
  useEffect(() => {
    const toPreview = () => {
      if (window.location.hash !== '#preview') return;
      const preview = document.getElementById('preview');
      preview?.scrollIntoView();
      preview?.focus({ preventScroll: true });
    };
    toPreview();
    window.addEventListener('hashchange', toPreview);
    return () => window.removeEventListener('hashchange', toPreview);
  }, []);

  function startEditing() {
    const { input, inexact } = inputFromVariables(fields, approval.body_variables);
    setEditing({ initial: input, current: input, inexact });
    setTried(false);
    setNotice(null);
  }

  function ask(next: Decision) {
    setNotice(null);
    if (DECISIONS[next].withEdit) {
      setTried(true);
      if (!edit?.ok || edit.changed.length === 0) return;
    }
    setDecision(next);
  }

  async function decide(chosen: Decision, text: string) {
    setBusy(true);
    const body = decisionBody(chosen, text, edit?.ok ? edit.variables : null);
    try {
      const answer = await api.post<MailApproval>(`/mail_approvals/${encodeURIComponent(approval.id)}/${DECISIONS[chosen].path}`, body);
      approvalsChanged();
      await reload();
      setEditing(null);
      const problem = notificationNote(answer.notification);
      const done = DECISIONS[chosen].done;
      setNotice({ tone: problem ? 'warning' : 'success', text: problem ? `${done} ${problem}` : done });
    } catch (error) {
      const refusal = approvalRefusal(error, chosen);
      if (refusal.reload) await reload();
      setNotice({ tone: 'error', text: refusal.text });
    } finally {
      setDecision(null);
      setBusy(false);
    }
  }

  const audience = approvalAudience(approval, PEOPLE_NAMED);
  const warnings = editing && edit?.ok ? fieldWarnings(fields.filter((field) => edit.changed.includes(field.name)), editing.current) : {};

  return (
    <div className="space-y-6">
      <PageHeader
        title={approval.template.name}
        description={`Mail onayı · ${submitterName(approval.submitter)} ${formatClubTime(approval.submitted_at)} tarihinde sundu`}
        meta={
          <>
            <ApprovalStateBadge state={actions.state} />
            {approval.template.key ? <span className="text-2xs font-mono text-neutral-500">{approval.template.key}</span> : null}
          </>
        }
      />

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <section aria-label="Karar" className="space-y-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        {editing ? (
          <EditPanel
            fields={fields}
            editing={editing}
            onInput={(current) => setEditing({ ...editing, current })}
            problems={tried && edit && !edit.ok ? edit.problems : null}
            warnings={warnings}
            unchanged={tried && edit?.ok === true && edit.changed.length === 0}
            busy={busy}
            onCancel={() => setEditing(null)}
            onReturn={() => ask('return')}
            onSend={() => ask('approveEdited')}
          />
        ) : (
          <DecisionPanel
            approval={approval}
            actions={actions}
            fields={fields}
            pinned={pinnedSource}
            recipient={recipient}
            busy={busy}
            onDecide={ask}
            onEdit={startEditing}
          />
        )}
      </section>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Fact term="Kitle" className="col-span-2 sm:col-span-1">
          <Audience audience={audience} />
        </Fact>
        <Fact term="Alıcılar">
          <span className="tabular-nums">
            {approval.recipient_count === null ? 'Bilinmiyor' : approval.recipient_count === 0 ? 'Alıcı yok' : `${formatCount(approval.recipient_count)} alıcı`}
          </span>
        </Fact>
        <Fact term="Sunan">
          <Submitter submitter={approval.submitter} />
        </Fact>
        <Fact term="Sunuldu">
          <span className="tabular-nums">{formatClubTime(approval.submitted_at)}</span>
        </Fact>
        <Fact term="Son tarih">
          <Deadline item={approval} now={now} />
        </Fact>
        <Fact term="Mail template">
          <span className="block truncate">{approval.template.name}</span>
          <span className="text-2xs block whitespace-normal text-neutral-500">
            {approval.template.republished ? 'Sunulduktan sonra yeni sürümü yayımlandı' : 'Sunulduğu andaki yayımlanmış sürümü'}
          </span>
        </Fact>
      </dl>

      <Recipients approval={approval} />

      <PreviewSection approval={approval} />

      <section aria-labelledby="variables-title">
        <SectionTitle id="variables-title">Değişkenler</SectionTitle>
        <Variables approval={approval} fields={fields} />
      </section>

      <section aria-labelledby="history-title">
        <SectionTitle id="history-title">Geçmiş</SectionTitle>
        <ApprovalHistory approval={approval} fields={fields} />
      </section>

      <DecisionDialog
        key={decision ?? 'none'}
        decision={decision}
        approval={approval}
        edited={edit?.ok ? edit.variables : null}
        fields={fields}
        pinned={pinnedSource}
        recipient={recipient}
        busy={busy}
        onCancel={() => setDecision(null)}
        onConfirm={(chosen, text) => void decide(chosen, text)}
      />
    </div>
  );
}

function Fact({ term, children, className = '' }: { term: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-md border border-white/5 bg-white/[0.03] px-3.5 py-3 ${className}`}>
      <dt className="text-2xs text-neutral-500">{term}</dt>
      <dd className="mt-1 min-w-0 text-sm text-neutral-200">{children}</dd>
    </div>
  );
}

/** The panel's heading and what it says, above its buttons. */
function Lead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-sm font-medium text-neutral-100">{title}</h2>
      {children ? <div className="space-y-1 text-sm text-neutral-400">{children}</div> : null}
    </div>
  );
}

function DeadlineLine({ approval }: { approval: MailApproval }) {
  const hint = deadlineHint(approval.deadline_at);
  return (
    <p>
      Son tarih {formatClubTime(approval.deadline_at)}
      {hint && !hint.passed ? ` (${hint.text})` : ''}: o zamana kadar karar verilmezse süresi dolar ve gönderilmez.
    </p>
  );
}

/** What the viewer can do with the request now, or where it stands when there is nothing. */
function DecisionPanel({
  approval,
  actions,
  fields,
  pinned,
  recipient,
  busy,
  onDecide,
  onEdit,
}: {
  approval: MailApproval;
  actions: ViewerActions;
  fields: readonly VariableField[];
  pinned: PinnedSource;
  recipient: Readonly<{ full_name: string; email: string }>;
  busy: boolean;
  onDecide: (decision: Decision) => void;
  onEdit: () => void;
}) {
  const can = (action: ViewerActions['actions'][number]) => actions.actions.includes(action);
  const decision = [...(approval.history ?? [])].sort((a, b) => a.seq - b.seq).findLast((event) => event.kind === 'rejected' || event.kind === 'declined');
  const republished = (
    <NoticeBox tone="warning">
      Bu istek sunulduktan sonra “{approval.template.name}” template&apos;inin yeni bir sürümü yayımlandı. Onaylanırsa sunulan mail
      gitmez; bu yüzden {can('decline') ? 'düzenleme kabul edilemez. Kabul etmeyip isteği yeni sürümle yeniden sunabilirsin.' : 'onaylanamaz. İsteği gerekçesiyle reddet; sunan yeni sürümle yeniden sunabilir.'}
    </NoticeBox>
  );

  if (can('approve') || can('reject')) {
    return (
      <>
        <Lead title="Bu istek onayını bekliyor">
          <p>
            Olduğu gibi onayla; değişkenlerini düzenleyip gönder ya da sunana geri gönder; ya da gerekçesiyle reddet.
            {actions.mine ? ' Bu senin isteğin: geçmişte hem sunan hem karar veren olarak görünürsün.' : ''}
          </p>
          <DeadlineLine approval={approval} />
        </Lead>
        {actions.republished ? republished : null}
        <div className="flex flex-wrap gap-2">
          {can('approve') ? (
            <Button onClick={() => onDecide('approve')} disabled={busy}>
              Onayla ve gönder…
            </Button>
          ) : null}
          {can('edit') ? (
            <Button variant="secondary" onClick={onEdit} disabled={busy || pinned.status === 'loading'}>
              Düzenle
            </Button>
          ) : null}
          <Button variant="outlineDanger" onClick={() => onDecide('reject')} disabled={busy}>
            Reddet…
          </Button>
        </div>
      </>
    );
  }

  if (can('accept') || can('decline')) {
    const before = valuesBeforeEdit(approval);
    return (
      <>
        <Lead title="Onaycı isteğini düzenleyip sana geri gönderdi">
          <p>
            {before?.editor ? `${eventActorName({ actor: before.editor })} ` : ''}değişkenleri değiştirdi. Kabul edersen düzenlenmiş hâli
            gönderilir; etmezsen isteği kendi değerlerinle düzenleyip yeniden sunabilirsin.
          </p>
          {before?.note ? <p className="text-neutral-300">Onaycının notu: “{before.note}”</p> : null}
          <DeadlineLine approval={approval} />
        </Lead>
        {actions.republished ? republished : null}
        <EditComparison
          before={before?.before ?? approval.body_variables}
          after={approval.body_variables}
          fields={fields}
          pinned={pinned}
          recipient={recipient}
          labels={['Senin sunduğun', 'Onaycının düzenlemesi']}
        />
        <div className="flex flex-wrap gap-2">
          {can('accept') ? (
            <Button onClick={() => onDecide('accept')} disabled={busy}>
              Kabul et ve gönder…
            </Button>
          ) : null}
          <Button variant="outlineDanger" onClick={() => onDecide('decline')} disabled={busy}>
            Kabul etme…
          </Button>
        </div>
      </>
    );
  }

  if (can('resubmit')) {
    return (
      <>
        <Lead title={actions.state === 'rejected' ? 'İsteğin reddedildi' : 'Onaycının düzenlemesini kabul etmedin'}>
          {decision?.kind === 'rejected' ? (
            <p className="text-neutral-300">
              {eventActorName(decision)}: “{decision.note}”
            </p>
          ) : null}
          <p>Hiçbir şey gönderilmedi. İsteği düzenleyip yeniden onaya sunabilirsin; 7 günlük süre yeniden başlar.</p>
        </Lead>
        <div>
          <Button href={resubmitHref(approval.id)}>Düzenleyip yeniden sun</Button>
        </div>
      </>
    );
  }

  if (can('copy')) {
    return (
      <>
        <Lead title="Süresi doldu">
          <p>7 gün içinde karar verilmediği için bu istek gönderilmedi ve artık gönderilmez; yeniden sunulamaz.</p>
          <p>Aynı değerlerle yeni bir gönderim başlatabilirsin.</p>
        </Lead>
        <div>
          <Button variant="secondary" href={copyApprovalHref(approval.id)}>
            Bu istekten yeni gönderim başlat
          </Button>
        </div>
      </>
    );
  }

  switch (actions.state) {
    case 'pending':
      return (
        <Lead title="Onaycıların kararı bekleniyor">
          <p>Bir onaycı onaylayınca gönderilir. Onaycı değişkenleri düzenleyip sana geri gönderebilir ya da gerekçesiyle reddedebilir.</p>
          <DeadlineLine approval={approval} />
        </Lead>
      );
    case 'returned':
      return (
        <Lead title="Sunanın kararı bekleniyor">
          <p>Düzenleme sunana geri gönderildi; kabul ederse gönderilir.</p>
          <DeadlineLine approval={approval} />
        </Lead>
      );
    case 'approved': {
      const sends = approvalSends(approval);
      return (
        <>
          <Lead title="Onaylandı ve gönderildi">
            {sends.length > 1 ? <p>Her kişiye ayrı bir gönderim açıldı: {formatCount(sends.length)} gönderim.</p> : null}
          </Lead>
          <SendsLink item={approval} />
        </>
      );
    }
    case 'rejected':
      return (
        <Lead title="Reddedildi">
          {decision?.note ? (
            <p className="text-neutral-300">
              {eventActorName(decision)}: “{decision.note}”
            </p>
          ) : null}
          <p>Hiçbir şey gönderilmedi; sunan düzenleyip yeniden sunabilir.</p>
        </Lead>
      );
    case 'declined':
      return (
        <Lead title="Sunan düzenlemeyi kabul etmedi">
          <p>Hiçbir şey gönderilmedi; sunan düzenleyip yeniden sunabilir.</p>
        </Lead>
      );
    default:
      return (
        <Lead title="Süresi doldu">
          <p>7 gün içinde karar verilmediği için bu istek gönderilmedi ve artık gönderilmez.</p>
        </Lead>
      );
  }
}

/** The approver's edit: the send form's variable fields, then send it or return it. */
function EditPanel({
  fields,
  editing,
  onInput,
  problems,
  warnings,
  unchanged,
  busy,
  onCancel,
  onReturn,
  onSend,
}: {
  fields: readonly VariableField[];
  editing: Editing;
  onInput: (current: FieldInput) => void;
  problems: Readonly<Record<string, string>> | null;
  warnings: Readonly<Record<string, string>>;
  unchanged: boolean;
  busy: boolean;
  onCancel: () => void;
  onReturn: () => void;
  onSend: () => void;
}) {
  const { current } = editing;
  const inexact = fields.filter((field) => editing.inexact.includes(field.name));
  return (
    <>
      <Lead title="Değişkenleri düzenle">
        <p>
          Yalnız değişkenler düzenlenir; template&apos;i ya da kitleyi sunan yeniden sunarak değiştirir. Değiştirmediğin alan sunulduğu
          gibi kalır.
        </p>
      </Lead>
      {inexact.length > 0 ? (
        <NoticeBox tone="warning">
          {inexact.map((field) => field.label).join(', ')} Visual editöre birebir aktarılamadı: değiştirmezsen sunulduğu gibi gider,
          değiştirirsen editördeki hâliyle gider.
        </NoticeBox>
      ) : null}
      {fields.length === 0 ? (
        <p className="text-xs text-neutral-500">Bu istekte düzenlenecek bir değişken yok.</p>
      ) : (
        <VariableFields
          fields={fields}
          input={current}
          onValue={(name, value) => onInput({ ...current, values: { ...current.values, [name]: value } })}
          onRich={(name, source) => onInput({ ...current, rich: { ...current.rich, [name]: source } })}
          problems={problems}
          warnings={warnings}
        />
      )}
      {unchanged ? <NoticeBox tone="error">Henüz bir değişkeni değiştirmedin: olduğu gibi göndermek için “Onayla ve gönder”i kullan.</NoticeBox> : null}
      {problems ? <NoticeBox tone="error">Düzenleme gönderilemez: işaretli yerleri düzelt.</NoticeBox> : null}
      <div className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Vazgeç
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onReturn} disabled={busy}>
            Sunana geri gönder…
          </Button>
          <Button onClick={onSend} disabled={busy}>
            Düzenlemeyle gönder…
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Everyone a request to several people goes to, in the order submitted; once
 * approved, each with a link to their own send for someone who reads sends.
 * One person is named in the facts above, a list by its name.
 */
function Recipients({ approval }: { approval: MailApproval }) {
  const canSeeSends = useCan(ROLE.mailsRead);
  const people = approvalPeople(approval);
  if (people.length < 2) return null;
  const sends = approvalSends(approval);
  return (
    <section id={RECIPIENTS_ANCHOR} aria-labelledby="recipients-title" className="scroll-mt-20 md:scroll-mt-4">
      <SectionTitle id="recipients-title">Kişiler ({formatCount(people.length)})</SectionTitle>
      <ol className="max-h-80 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/5">
        {people.map((person, index) => {
          const send = sends[index];
          return (
            <li key={`${index}:${person.email}`} className="flex items-center gap-3 px-3.5 py-2 text-sm">
              <span className="text-2xs w-6 shrink-0 text-right text-neutral-600 tabular-nums" aria-hidden>
                {index + 1}.
              </span>
              <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className="truncate text-neutral-200">{recipientName(person)}</span>
                {person.full_name.trim() ? <span className="text-2xs truncate text-neutral-500">{person.email}</span> : null}
              </span>
              {send && canSeeSends ? (
                <Link
                  href={sendHref(send)}
                  aria-label={`${recipientName(person)}: gönderimi gör`}
                  className="text-skylab-300 shrink-0 text-xs hover:underline"
                >
                  Gönderimi gör
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The mail as it would go out, rendered by the server, in either mail theme; never in the page itself. */
function PreviewSection({ approval }: { approval: MailApproval }) {
  const [scheme, setScheme] = useState<MailScheme>('light');
  const preview = approval.preview;
  return (
    // Scrolled to from the mail's #preview link: clear of the phone's sticky top bar.
    <section id="preview" tabIndex={-1} aria-labelledby="preview-title" className="scroll-mt-20 space-y-3 outline-none md:scroll-mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="preview-title" className="text-sm font-medium text-neutral-100">
          Önizleme
        </h2>
        <SchemeToggle value={scheme} onChange={setScheme} />
      </div>
      {preview ? (
        <>
          <p className="text-xs text-neutral-500">{previewNote(approval)}</p>
          <p className="text-sm break-words text-neutral-200">
            <span className="text-2xs mr-2 font-medium tracking-[0.14em] text-neutral-500 uppercase">Konu</span>
            {preview.subject.trim() === '' ? <span className="text-neutral-500">—</span> : preview.subject}
          </p>
          <MailFrame title="İsteğin önizlemesi" html={preview.html} scheme={scheme} className="h-[70vh] min-h-[420px]" />
        </>
      ) : (
        <NoticeBox tone="warning">{previewFailureNote(approval)}</NoticeBox>
      )}
    </section>
  );
}

/** The request's values, each by its field's name; a body as its words (the preview shows it as mail). */
function Variables({ approval, fields }: { approval: MailApproval; fields: readonly VariableField[] }) {
  const variables = approval.body_variables ?? {};
  // approvalFields gives a field for every value the request carries.
  if (fields.length === 0) return <p className="text-xs text-neutral-500">Bu istekte değişken yok.</p>;
  return (
    <dl className="divide-y divide-white/5 rounded-lg border border-white/5">
      {fields.map((field) => {
        const text = valueText(variables[field.name], field.kind);
        return (
          <div key={field.name} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-xs text-neutral-400">
              {field.label}
              {field.label !== field.name ? <code className="text-2xs ml-2 text-neutral-500">{field.name}</code> : null}
            </dt>
            <dd className="max-h-48 overflow-y-auto text-sm break-words whitespace-pre-line text-neutral-200">
              {text === null || text === '' ? <span className="text-neutral-600">boş</span> : text}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
