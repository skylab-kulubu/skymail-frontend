import type { Metadata } from 'next';
import { ResubmitForm } from '@/components/sends/compose/SendForm';

export const metadata: Metadata = { title: 'İsteği yeniden sun' };

// A rejected or declined request for approval, edited in the send form and
// submitted again (ticket 20).
export default async function Page({ params }: PageProps<'/mail-approvals/edit/[id]'>) {
  const { id } = await params;
  return <ResubmitForm id={id} />;
}
