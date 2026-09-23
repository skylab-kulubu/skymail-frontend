import type { Metadata } from 'next';
import { Suspense } from 'react';
import { sectionLabel } from '@/lib/access';
import { TemplatesPage } from './_components/TemplatesPage';

export const metadata: Metadata = { title: sectionLabel('/templates') };

export default function Page() {
  // The filter and the page live in the address (useSearchParams).
  return (
    <Suspense fallback={null}>
      <TemplatesPage />
    </Suspense>
  );
}
