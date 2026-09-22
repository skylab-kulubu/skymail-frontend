import type { Metadata } from 'next';
import { MailTasksInterim } from '@/components/pages/MailTasksInterim';

export const metadata: Metadata = { title: "Gönderimler" };

export default function Page() {
  return <MailTasksInterim />;
}
