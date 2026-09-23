'use client';

import { NoticeBox } from '@/components/chrome/Notice';
import { formatClubTime } from '@/lib/format';
import { eventActorName, type MailApproval } from '@/lib/mail-approvals/approvals';

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
        <NoticeBox tone="info">
          “{approval.template.name}” isteğinin değerleriyle dolduruldu ({formatClubTime(approval.submitted_at)} sunulmuştu). Göndermeden
          önce bak: onaya sunarsan yeni bir istek olur ve 7 günlük süresi baştan başlar.
        </NoticeBox>
      ) : decision?.kind === 'rejected' ? (
        <NoticeBox tone="warning">
          <p className="font-medium">
            {eventActorName(decision)} {formatClubTime(decision.at)} tarihinde reddetti.
          </p>
          {decision.note ? <p className="mt-1 whitespace-pre-line">Gerekçe: {decision.note}</p> : null}
        </NoticeBox>
      ) : decision ? (
        <NoticeBox tone="info">
          Onaycının düzenlemesini kabul etmedin{decision.note ? ` (“${decision.note}”)` : ''}. Form senin sunduğun değerlerle
          dolduruldu; onaycının düzenlemesi isteğin sayfasında.
        </NoticeBox>
      ) : null}
      {notes.length > 0 ? (
        <NoticeBox tone="warning">
          <ul className="list-disc space-y-0.5 pl-4">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </NoticeBox>
      ) : null}
    </div>
  );
}
