'use client';

import { unstable_isUnrecognizedActionError } from 'next/navigation';
import { useEffect } from 'react';
import { ServerErrorScenePage, StateCard } from '@skylab-kulubu/skylcn-ui';
import { recoverFromVersionSkew } from '@/lib/version-skew';
import './globals.css';

/**
 * The last error boundary: it replaces the root layout, so it brings its own
 * <html> and <body>. A Server Action from a build that is no longer running
 * (a tab left open across a deploy) reloads the page instead (see
 * src/lib/version-skew.ts); anything else gets the 500 scene and a retry.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    recoverFromVersionSkew(error, () => window.location.reload());
  }, [error]);

  return (
    <html lang="tr">
      <body className="antialiased">
        {unstable_isUnrecognizedActionError(error) ? (
          <StateCard loading title="SkyNotify güncellendi, sayfa yenileniyor" />
        ) : (
          <ServerErrorScenePage onAction={reset} />
        )}
      </body>
    </html>
  );
}
