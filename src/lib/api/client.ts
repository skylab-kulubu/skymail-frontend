/**
 * The one HTTP client the panel uses to reach the SkyMail API.
 */
import { ApiError, apiErrorFromResponse, networkError } from "./errors";

export { ApiError } from "./errors";

/** What the client needs from the Auth.js session. */
export type ClientSession = {
  accessToken?: string | null;
  /** Set when the server could not refresh the access token any more. */
  error?: string | null;
};

export type ApiClientOptions = {
  /** The API base, e.g. `https://api.yildizskylab.com/api/skymail/v1`. */
  baseUrl: string;
  /** Reads the current session; called for every request. */
  getSession: () => Promise<ClientSession | null>;
  fetch?: typeof globalThis.fetch;
};

type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  /** Appended to the path; `undefined` and `null` values are left out. */
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Every method resolves to the parsed JSON body, or to `undefined` when the
 * answer has no body (204 on archive, restore and recipient removal) — pass
 * `void` as the type for those.
 */
export type ApiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T = void>(path: string, options?: RequestOptions): Promise<T>;
  /**
   * Calls `listener` whenever a request finds the session over: the API
   * answered 401, or the session could not be refreshed. Returns the
   * unsubscribe function.
   */
  onSessionEnded(listener: () => void): () => void;
};

function withQuery(url: string, query: RequestOptions["query"]): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

export function createApiClient({
  baseUrl,
  getSession,
  fetch = globalThis.fetch,
}: ApiClientOptions): ApiClient {
  // Every session read may refresh the access token on the server, and
  // Keycloak rotates refresh tokens: two refreshes racing each other leave the
  // loser holding a spent token. Requests that start together therefore share
  // one read; the next request after it settles reads again.
  let inflightSession: Promise<ClientSession | null> | null = null;
  function sharedSession(): Promise<ClientSession | null> {
    inflightSession ??= getSession().finally(() => {
      inflightSession = null;
    });
    return inflightSession;
  }

  const sessionEndedListeners = new Set<() => void>();
  function announceSessionEnded(): void {
    for (const listener of [...sessionEndedListeners]) listener();
  }

  async function request<T>(
    method: Method,
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const current = await sharedSession();
    // The server already tried and failed to refresh the token; sending the
    // stale one would only earn a 401 after the operator filled in a form.
    if (current?.error) {
      announceSessionEnded();
      throw new ApiError(401, "session.ended");
    }

    const headers = new Headers({ Accept: "application/json" });
    if (current?.accessToken) headers.set("Authorization", `Bearer ${current.accessToken}`);
    if (body !== undefined) headers.set("Content-Type", "application/json");

    let response: Response;
    try {
      response = await fetch(withQuery(`${baseUrl}${path}`, options.query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal,
      });
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      throw networkError(cause);
    }

    // A 204 cannot carry a body, and an archive or restore answers with one.
    // Reading the text first means an empty answer is a success, not a
    // JSON parse error reported to the operator as a failed action.
    const text = await response.text();
    if (!response.ok) {
      if (response.status === 401) announceSessionEnded();
      throw apiErrorFromResponse(response.status, text);
    }
    if (text === "") return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(response.status, "response.not_json");
    }
  }

  return {
    get: (path, options) => request("GET", path, undefined, options),
    post: (path, body, options) => request("POST", path, body, options),
    put: (path, body, options) => request("PUT", path, body, options),
    patch: (path, body, options) => request("PATCH", path, body, options),
    delete: (path, options) => request("DELETE", path, undefined, options),
    onSessionEnded(listener) {
      sessionEndedListeners.add(listener);
      return () => {
        sessionEndedListeners.delete(listener);
      };
    },
  };
}
