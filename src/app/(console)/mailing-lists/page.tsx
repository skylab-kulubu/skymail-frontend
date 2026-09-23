import type { Metadata } from 'next';
import { Suspense } from 'react';
import { sectionLabel } from '@/lib/access';
import { MailingListsPage } from './_components/MailingListsPage';

export const metadata: Metadata = { title: sectionLabel('/mailing-lists') };

export default function Page() {
  // The filter and the page live in the address (useSearchParams).
  return (
    <Suspense fallback={null}>
      <MailingListsPage />
    </Suspense>
  );
}
