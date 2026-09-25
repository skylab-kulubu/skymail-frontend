import type { Metadata } from 'next';
import { SendList } from '@/components/sends/SendList';
import { sectionLabel } from '@/lib/access';

export const metadata: Metadata = { title: sectionLabel('/mail-tasks') };

export default function Page() {
  // SendList reads ?status= and ?page= from the address.
  return <SendList />;
}
