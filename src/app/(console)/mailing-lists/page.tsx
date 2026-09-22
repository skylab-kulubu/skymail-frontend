import type { Metadata } from 'next';
import { MailingListsInterim } from '@/components/pages/MailingListsInterim';

export const metadata: Metadata = { title: "Mail listeleri" };

export default function Page() {
  return <MailingListsInterim />;
}
