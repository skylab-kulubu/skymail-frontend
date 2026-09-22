import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SendDetail } from '@/components/sends/SendDetail';

export const metadata: Metadata = { title: 'Gönderim' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Today's address for a send, as the old panel had it.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The API would answer an id that is not a UUID with an error, not a 404.
  if (!UUID.test(id)) notFound();
  return (
    <Suspense>
      <SendDetail id={id} />
    </Suspense>
  );
}
