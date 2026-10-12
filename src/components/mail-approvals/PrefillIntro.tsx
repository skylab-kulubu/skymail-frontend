'use client';

import { formatClubTime } from '@/lib/format';
import { eventActorName, type MailApproval } from '@/lib/mail-approvals/approvals';
import { Notice } from '@skylab-kulubu/skylcn-ui';

/**
 * What the send form was filled from, said above it: a rejected request and
 * its reason, a returned edit the submitter declined, or an expired request
 * a new one starts from; and anything that could not be filled as it was.
 */
export function PrefillIntro({ approval, mode, notes }: { approval: MailApproval; mode: 'copy' | 'resubmit'; notes: readonly string[] }) {
  const decision = [...(approval.history ?? [])].reverse().find((event) => event.kind === 'rejected' || event.kind === 'declined');
  return (
    <div className="space-y-3">
      {mode === 'copy' ? (
        <Notice tone="info">
          “{approval.template.name}” isteğinin değerleriyle dolduruldu ({formatClubTime(approval.submitted_at)} sunulmuştu). Göndermeden
          önce bak: onaya sunarsan yeni bir istek olur ve 7 günlük süresi baştan başlar.
        </Notice>
      ) : decision?.kind === 'rejected' ? (
        <Notice tone="warning">
          <p className="font-medium">
            {eventActorName(decision)} {formatClubTime(decision.at)} tarihinde reddetti.
          </p>
          {decision.note ? <p className="mt-1 whitespace-pre-line">Gerekçe: {decision.note}</p> : null}
        </Notice>
      ) : decision ? (
        <Notice tone="info">
          Onaycının düzenlemesini kabul etmedin{decision.note ? ` (“${decision.note}”)` : ''}. Form senin sunduğun değerlerle
          dolduruldu; onaycının düzenlemesi isteğin sayfasında.
        </Notice>
      ) : null}
      {notes.length > 0 ? (
        <Notice tone="warning">
          <ul className="list-disc space-y-0.5 pl-4">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}
