'use client';

/**
 * The HTTP client for React: one instance per page load, reading the token
 * from the Auth.js session on every request.
 */
import { getSession } from 'next-auth/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createApiClient, type ApiClient, type ApiPage, type RequestOptions } from './client';
import { asApiError, type ApiError } from './errors';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  // getSession() asks /api/auth/session, which is where Auth.js refreshes an
  // expiring token — so every request carries a live one.
  const [api] = useState(() => createApiClient({ baseUrl, getSession: () => getSession() }));
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside ApiProvider');
  return api;
}

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: ApiError };

export type Query<T> = QueryState<T> & {
  /**
   * Loads again, keeping the current data on screen meanwhile. Resolves once
   * the new answer is rendered, so an action can report its success together
   * with the rows it changed.
   */
  reload: () => Promise<void>;
};

/**
 * Runs `load` whenever `key` changes, and again on `reload()`. A new key shows
 * the loading state; a reload does not. An answer that arrives after its key
 * changed or after a newer reload started is dropped (its request is aborted).
 */
export function useApiLoad<T>(
  load: (api: ApiClient, signal: AbortSignal) => Promise<T>,
  key: string,
): Query<T> {
  const api = useApi();
  const [shown, setShown] = useState<{ key: string; round: number; state: QueryState<T> } | null>(null);
  const [round, setRound] = useState(0);
  const rounds = useRef(0);
  const waiting = useRef<Array<{ round: number; resolve: () => void }>>([]);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    const show = (state: QueryState<T>) => {
      if (!controller.signal.aborted) setShown({ key, round, state });
    };
    loadRef.current(api, controller.signal).then(
      (data) => show({ status: 'success', data }),
      (error: unknown) => show({ status: 'error', error: asApiError(error) }),
    );
    return () => controller.abort();
  }, [api, key, round]);

  // Runs after the answer is rendered: settle the reloads it answers.
  useEffect(() => {
    if (!shown) return;
    const settled = waiting.current.filter((wait) => wait.round <= shown.round);
    waiting.current = waiting.current.filter((wait) => wait.round > shown.round);
    for (const wait of settled) wait.resolve();
  }, [shown]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        rounds.current += 1;
        waiting.current.push({ round: rounds.current, resolve });
        setRound(rounds.current);
      }),
    [],
  );

  const state: QueryState<T> = shown?.key === key ? shown.state : { status: 'loading' };
  return { ...state, reload };
}

/** Loads `path` once per change of path or query, and again on `reload()`. */
export function useApiQuery<T>(path: string, query?: RequestOptions['query']): Query<T> {
  const queryKey = JSON.stringify(query ?? {});
  return useApiLoad<T>(
    (api, signal) =>
      api.get<T>(path, { query: JSON.parse(queryKey) as RequestOptions['query'], signal }),
    `${path}?${queryKey}`,
  );
}

/** Loads one page of a list route (`_start`/`_end`) with its `X-Total-Count`. */
export function useApiPage<T>(path: string, query?: RequestOptions['query']): Query<ApiPage<T>> {
  const queryKey = JSON.stringify(query ?? {});
  return useApiLoad<ApiPage<T>>(
    (api, signal) =>
      api.getPage<T>(path, { query: JSON.parse(queryKey) as RequestOptions['query'], signal }),
    `${path}?${queryKey}`,
  );
}
