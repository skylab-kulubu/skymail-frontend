import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApprovalList } from '@/components/mail-approvals/ApprovalList';
import { sectionLabel } from '@/lib/access';

export const metadata: Metadata = { title: sectionLabel('/mail-approvals') };

export default function Page() {
  // ApprovalList reads ?state= and ?page= from the address.
  return (
    <Suspense>
      <ApprovalList />
    </Suspense>
  );
}
