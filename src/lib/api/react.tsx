'use client';

/**
 * The HTTP client for React: one instance per page load, reading the token
 * from the Auth.js session on every request.
 */
import { getSession } from 'next-auth/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, createApiClient, type ApiClient, type RequestOptions } from './client';

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

/** Loads `path` once per change of path or query. */
export function useApiQuery<T>(path: string, query?: RequestOptions['query']): QueryState<T> {
  const api = useApi();
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const queryKey = JSON.stringify(query ?? {});

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    api
      .get<T>(path, { query: JSON.parse(queryKey) as RequestOptions['query'], signal: controller.signal })
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError(0, 'network'),
        });
      });
    return () => controller.abort();
  }, [api, path, queryKey]);

  return state;
}
