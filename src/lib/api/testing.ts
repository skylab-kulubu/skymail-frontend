/**
 * Test doubles for driving the HTTP client the way a page does: a fetch that
 * answers with scripted responses and records what went out. For tests only;
 * no page imports this module.
 */
import { createApiClient, type ApiClient } from "./client";

export const TEST_BASE_URL = "https://api.example.test/api/skymail/v1";

export type RecordedCall = { url: string; method: string; headers: Headers; body: string | null };

/** A fetch double that records every call and answers with the next scripted response. */
export function scriptedFetch(...responses: Array<Response | (() => Response | Promise<Response>)>) {
  const calls: RecordedCall[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : null,
    });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${String(input)}`);
    return typeof next === "function" ? next() : next;
  };
  return { fetch, calls };
}

/** A JSON answer, with extra headers such as `X-Total-Count`. */
export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** A client for a signed-in session whose requests get the scripted answers, in order. */
export function scriptedClient(...responses: Response[]): { api: ApiClient; calls: RecordedCall[] } {
  const { fetch, calls } = scriptedFetch(...responses);
  const api = createApiClient({
    baseUrl: TEST_BASE_URL,
    fetch,
    getSession: async () => ({ accessToken: "token" }),
  });
  return { api, calls };
}
