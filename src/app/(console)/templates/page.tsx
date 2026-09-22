import type { Metadata } from 'next';
import { TemplatesInterim } from '@/components/pages/TemplatesInterim';

export const metadata: Metadata = { title: "Mail template'ler" };

export default function Page() {
  return <TemplatesInterim />;
}
