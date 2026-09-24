import Link from 'next/link';
import { AlertTriangle, SearchX } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { Button } from '@/components/ui/Button';
import type { ApiError } from '@/lib/api/errors';
import { listHref } from '@/lib/mailing-lists';

/**
 * A list that would not load. A 404 is a missing or archived list — every
 * read of an archived list answers 404 — so it points to where archived lists
 * are; anything else can be tried again.
 */
export function ListLoadFailure({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.status === 404) {
    return (
      <StateCard
        Icon={SearchX}
        title="Liste bulunamadı"
        description="Bu adreste bir liste yok ya da liste arşivlenmiş. Arşivlenmiş bir liste, Mail listeleri ekranındaki Arşivli filtresinde görünür ve oradan geri alınabilir."
      >
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link href={listHref.index} className="text-skylab-300 hover:underline">
            Mail listelerine dön
          </Link>
          <Link href={listHref.archived} className="text-skylab-300 hover:underline">
            Arşivli listeler
          </Link>
        </div>
      </StateCard>
    );
  }
  return (
    <StateCard Icon={AlertTriangle} tone="danger" title="Liste yüklenemedi" description={error.message}>
      <Button variant="secondary" onClick={onRetry}>
        Tekrar dene
      </Button>
    </StateCard>
  );
}
