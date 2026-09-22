import type { Metadata } from 'next';
import { sectionLabel } from '@/lib/access';
import { MailTasksInterim } from '@/components/pages/MailTasksInterim';

export const metadata: Metadata = { title: sectionLabel('/mail-tasks') };

export default function Page() {
  return <MailTasksInterim />;
}
