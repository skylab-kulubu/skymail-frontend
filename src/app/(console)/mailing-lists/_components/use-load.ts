'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';

export type LoadState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: ApiError };

/**
 * Runs `load` whenever `key` changes, and again on `reload()`. A new key shows
 * the loading state; a reload keeps the rows on screen until the new ones
 * arrive, so archiving a row does not blank the table. `reload()` settles once
 * the new rows are shown, so an action can report success together with them.
 */
export function useLoad<T>(
  load: (api: ApiClient, signal: AbortSignal) => Promise<T>,
  key: string,
): LoadState<T> & { reload: () => Promise<void> } {
  const api = useApi();
  const [loaded, setLoaded] = useState<{ key: string; state: LoadState<T> } | null>(null);
  const [round, setRound] = useState(0);
  const loadRef = useRef(load);
  const waiting = useRef<Array<() => void>>([]);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    const settle = (state: LoadState<T>) => {
      if (controller.signal.aborted) return;
      setLoaded({ key, state });
      const settled = waiting.current;
      waiting.current = [];
      for (const resolve of settled) resolve();
    };
    loadRef.current(api, controller.signal).then(
      (data) => settle({ status: 'success', data }),
      (error: unknown) =>
        settle({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError(0, 'network'),
        }),
    );
    return () => controller.abort();
  }, [api, key, round]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiting.current.push(resolve);
        setRound((n) => n + 1);
      }),
    [],
  );
  const state: LoadState<T> = loaded?.key === key ? loaded.state : { status: 'loading' };
  return { ...state, reload };
}
