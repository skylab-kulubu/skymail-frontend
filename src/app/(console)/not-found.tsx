import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';

export default function NotFound() {
  return (
    <StateCard Icon={SearchX} title="Sayfa bulunamadı" description="Bu adreste bir sayfa yok.">
      <Link href="/" className="text-skylab-300 text-sm hover:underline">
        Ana sayfaya dön
      </Link>
    </StateCard>
  );
}
