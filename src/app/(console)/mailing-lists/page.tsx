import type { Metadata } from 'next';
import { sectionLabel } from '@/lib/access';
import { MailingListsInterim } from '@/components/pages/MailingListsInterim';

export const metadata: Metadata = { title: sectionLabel('/mailing-lists') };

export default function Page() {
  return <MailingListsInterim />;
}
