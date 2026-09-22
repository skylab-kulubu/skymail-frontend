import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SendDetail } from '@/components/sends/SendDetail';

export const metadata: Metadata = { title: 'Gönderim' };

// Today's address for a send, as the old panel had it. SendDetail reads the
// recipient filter and page from the address.
export default async function Page({ params }: PageProps<'/mail-tasks/show/[id]'>) {
  const { id } = await params;
  return (
    <Suspense>
      <SendDetail id={id} />
    </Suspense>
  );
}
