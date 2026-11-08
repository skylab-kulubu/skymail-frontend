import Link from 'next/link';
import { Lock } from 'lucide-react';
import { StateCard } from '@skylab-kulubu/skylcn-ui';
import { APPROVAL_LIST_PATH } from '@/lib/mail-approvals/approvals';

/**
 * The home screen of one who can neither read the sends nor compose one
 * (access.ts homeScreen). An approver can still decide requests: theirs
 * leads to the mail approvals.
 */
export function HomeLock({ approver }: { approver: boolean }) {
  return (
    <StateCard
      icon={Lock}
      tone="warning"
      title="Gönderim yetkin yok"
      description={
        approver
          ? 'Onaya sunulan gönderimlere Mail onayları sayfasından karar verebilirsin. Mail hazırlamak için kulüp yönetimine başvur.'
          : 'Mail hazırlamak ya da onaya sunmak için kulüp yönetimine başvur.'
      }
    >
      {approver ? (
        <Link href={APPROVAL_LIST_PATH} className="text-skylab-300 text-sm hover:underline">
          Mail onaylarına git
        </Link>
      ) : null}
    </StateCard>
  );
}
