'use client';

import { TriangleAlert } from 'lucide-react';
import { unstable_isUnrecognizedActionError } from 'next/navigation';
import { useEffect } from 'react';
import { Button, StateCard } from '@skylab-kulubu/skylcn-ui';
import { recoverFromVersionSkew } from '@/lib/version-skew';
import './globals.css';

/**
 * The last error boundary: it replaces the root layout, so it brings its own
 * <html> and <body>. A Server Action from a build that is no longer running
 * (a tab left open across a deploy) reloads the page instead (see
 * src/lib/version-skew.ts); anything else gets a short message and a retry.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    recoverFromVersionSkew(error, () => window.location.reload());
  }, [error]);

  return (
    <html lang="tr">
      <body className="antialiased">
        {unstable_isUnrecognizedActionError(error) ? (
          <StateCard loading title="İletişim güncellendi, sayfa yenileniyor" />
        ) : (
          <StateCard
            icon={TriangleAlert}
            tone="danger"
            title="Bir şeyler ters gitti"
            description="Sayfa beklenmedik bir hatayla durdu."
          >
            <Button variant="primary" onClick={reset}>
              Tekrar dene
            </Button>
          </StateCard>
        )}
      </body>
    </html>
  );
}
