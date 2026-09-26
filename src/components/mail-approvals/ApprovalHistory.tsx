'use client';

import { formatClubTime } from '@/lib/format';
import { decidedOwnRequest, eventActorName, eventLabel, type ApprovalChange, type MailApproval } from '@/lib/mail-approvals/approvals';
import { valueText } from '@/lib/mail-approvals/edit';
import type { VariableField } from '@/lib/send-form/fields';
import { SendsLink } from './ApprovalParts';

function short(text: string | null): string {
  if (text === null || text === '') return 'boş';
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function ChangeLine({ change, fields }: { change: ApprovalChange; fields: readonly VariableField[] }) {
  if (change.field === 'template') return <li>Mail template&apos;in şimdi yayımlanmış sürümüne bağlandı.</li>;
  if (change.field === 'audience') return <li>Kitle değişti.</li>;
  const field = fields.find((candidate) => candidate.name === change.name);
  const kind = field?.kind ?? 'text';
  return (
    <li className="break-words">
      <span className="text-neutral-300">{field?.label ?? change.name}</span>: “{short(valueText(change.before, kind))}” → “
      {short(valueText(change.after, kind))}”
    </li>
  );
}

/**
 * Everything that happened to a request, oldest first: who did what and
 * when, a reason or a note, and each edit's changes before and after. An
 * approver who decided their own request is marked so; Silinmiş kullanıcı
 * never is, as everyone erased has the one subject. The event that sent
 * it names only the first send; each person's is beside them on the page.
 */
export function ApprovalHistory({ approval, fields }: { approval: MailApproval; fields: readonly VariableField[] }) {
  const events = [...(approval.history ?? [])].sort((a, b) => a.seq - b.seq);
  if (events.length === 0) return <p className="text-xs text-neutral-500">Kayıt yok.</p>;
  return (
    <ol className="space-y-3 border-l border-white/10 pl-4">
      {events.map((event) => {
        const own = decidedOwnRequest(event, approval.submitter);
        return (
          <li key={event.seq} className="relative space-y-1 text-sm">
            <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-neutral-600" aria-hidden />
            <p className="text-neutral-200">
              {event.actor ? (
                <>
                  <span className="font-medium">{eventActorName(event)}</span> {eventLabel(event).toLocaleLowerCase('tr-TR')}
                </>
              ) : (
                eventLabel(event)
              )}
              {own ? <span className="text-2xs ml-2 rounded border border-white/10 px-1.5 py-0.5 text-neutral-400">kendi isteği</span> : null}
            </p>
            <p className="text-2xs text-neutral-500 tabular-nums">{formatClubTime(event.at)}</p>
            {event.note ? (
              <p className="text-xs break-words whitespace-pre-line text-neutral-300">
                {event.kind === 'rejected' ? 'Gerekçe: ' : 'Not: '}“{event.note}”
              </p>
            ) : null}
            {event.changes && event.changes.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-neutral-400">
                {event.changes.map((change, index) => (
                  <ChangeLine key={`${change.field}:${change.name ?? index}`} change={change} fields={fields} />
                ))}
              </ul>
            ) : null}
            {event.task_id ? <SendsLink item={approval} className="text-xs" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
