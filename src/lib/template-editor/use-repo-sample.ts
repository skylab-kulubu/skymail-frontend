'use client';

import { useEffect, useState } from 'react';
import type { SampleValues } from '@/lib/mail-render/preview';
import { repoSample } from './samples';

/**
 * The sample values the repo's file declares for a Template key, loaded with
 * the template catalogue only when a page asks — none until then, and none
 * for a template the repo does not have.
 */
export function useRepoSample(key: string | null): SampleValues {
  const [loaded, setLoaded] = useState<{ key: string; sample: SampleValues } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    void import('../../../emails').then(
      ({ templates }) => {
        if (live) setLoaded({ key, sample: repoSample(templates, key) });
      },
      () => {
        // Without the catalogue the preview shows «Name» for every variable.
      },
    );
    return () => {
      live = false;
    };
  }, [key]);
  return loaded && loaded.key === key ? loaded.sample : {};
}
