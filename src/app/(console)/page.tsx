import type { Metadata } from 'next';
import { LayoutDashboard } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { sectionLabel } from '@/lib/access';

export const metadata: Metadata = { title: sectionLabel('/') };

export default function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader title={sectionLabel('/')} description="Kulübün gönderdiği mailler bir bakışta." />
      <StateCard
        Icon={LayoutDashboard}
        tone="brand"
        title="Gönderim özeti yakında burada"
        description="Son 30 günün gönderimleri, bekleyen ve başarısız gönderimler bu ekrana gelecek. Şimdilik soldaki menüden devam edebilirsin."
      />
    </div>
  );
}
