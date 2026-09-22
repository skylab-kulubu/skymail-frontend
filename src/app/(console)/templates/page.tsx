import type { Metadata } from 'next';
import { sectionLabel } from '@/lib/access';
import { TemplatesInterim } from '@/components/pages/TemplatesInterim';

export const metadata: Metadata = { title: sectionLabel('/templates') };

export default function Page() {
  return <TemplatesInterim />;
}
