import type { Metadata } from 'next';
import { ApprovalDetail } from '@/components/mail-approvals/ApprovalDetail';

export const metadata: Metadata = { title: 'Mail onayı' };

// Where the approval mails link (ticket 19): `ApproveUrl`, and `PreviewUrl`
// with `#preview`.
export default async function Page({ params }: PageProps<'/mail-approvals/show/[id]'>) {
  const { id } = await params;
  return <ApprovalDetail id={id} />;
}
