'use client';

import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { StateCard } from '@skylab-kulubu/skylcn-ui';

export default function NotFound() {
  return (
    <StateCard icon={SearchX} title="Sayfa bulunamadı" description="Bu adreste bir sayfa yok.">
      <Link href="/" className="text-skylab-300 text-sm hover:underline">
        Ana sayfaya dön
      </Link>
    </StateCard>
  );
}
