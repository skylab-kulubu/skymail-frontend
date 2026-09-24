import Link from 'next/link';
import { AlertTriangle, SearchX } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { Button } from '@/components/ui/Button';
import type { ApiError } from '@/lib/api/errors';
import { templateHref } from '@/lib/templates';

/**
 * A template that would not load. A 404 is a missing or archived one — every
 * read of an archived template answers 404 — so it points to where archived
 * templates are; anything else can be tried again.
 */
export function TemplateLoadFailure({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error.status === 404) {
    return (
      <StateCard
        Icon={SearchX}
        title="Mail template bulunamadı"
        description="Bu adreste bir Mail template yok ya da arşivlenmiş. Arşivlenmiş bir template, Mail template listesindeki Arşivli filtresinde görünür ve oradan geri alınabilir."
      >
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link href={templateHref.index} className="text-skylab-300 hover:underline">
            Mail template&apos;lere dön
          </Link>
          <Link href={templateHref.archived} className="text-skylab-300 hover:underline">
            Arşivli template&apos;ler
          </Link>
        </div>
      </StateCard>
    );
  }
  return (
    <StateCard Icon={AlertTriangle} tone="danger" title="Mail template yüklenemedi" description={error.message}>
      <Button variant="secondary" onClick={onRetry}>
        Tekrar dene
      </Button>
    </StateCard>
  );
}
