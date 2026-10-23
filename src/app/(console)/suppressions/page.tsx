import type { Metadata } from 'next';
import { sectionLabel } from '@/lib/access';
import { SuppressionsPage } from './_components/SuppressionsPage';

export const metadata: Metadata = { title: sectionLabel('/suppressions') };

export default function Page() {
  return <SuppressionsPage />;
}
