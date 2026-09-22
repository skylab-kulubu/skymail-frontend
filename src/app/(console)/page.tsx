import type { Metadata } from 'next';
import { HomeDashboard } from '@/components/sends/HomeDashboard';
import { sectionLabel } from '@/lib/access';

export const metadata: Metadata = { title: sectionLabel('/') };

export default function HomePage() {
  return <HomeDashboard />;
}
