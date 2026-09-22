import type { Metadata } from 'next';
import { LayoutDashboard } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { PageHeader } from '@/components/layout/PageHeader';

export const metadata: Metadata = { title: 'Ana sayfa' };

export default function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ana sayfa" description="Kulübün gönderdiği mailler bir bakışta." />
      <StateCard
        Icon={LayoutDashboard}
        tone="brand"
        title="Gönderim özeti yakında burada"
        description="Son 30 günün gönderimleri, bekleyen ve başarısız gönderimler bu ekrana gelecek. Şimdilik soldaki menüden devam edebilirsin."
      />
    </div>
  );
}
