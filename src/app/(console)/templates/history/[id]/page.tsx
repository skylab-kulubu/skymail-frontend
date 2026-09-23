import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TemplateHistory } from '../../_components/history/TemplateHistory';

export const metadata: Metadata = { title: 'Sürüm geçmişi' };

// The state filter and the page live in the address (useSearchParams).
export default async function Page({ params }: PageProps<'/templates/history/[id]'>) {
  const { id } = await params;
  return (
    <Suspense>
      <TemplateHistory id={id} />
    </Suspense>
  );
}
