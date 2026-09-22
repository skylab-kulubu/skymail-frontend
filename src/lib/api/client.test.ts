/**
 * The HTTP client is the one way the panel talks to the SkyMail API, so these
 * tests drive it the way a page does — through its public methods — with the
 * two things it depends on injected: `fetch` and the session getter. What they
 * pin down is what the operator sees: which token went out, whether a success
 * is reported as one, and what an error says.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError, createApiClient, type ClientSession } from "./client";

const BASE_URL = "https://api.example.test/api/skymail/v1";

type Call = { url: string; method: string; headers: Headers; body: string | null };

/** A fetch double that records every call and answers with the next scripted response. */
function scriptedFetch(...responses: Array<Response | (() => Response | Promise<Response>)>) {
  const calls: Call[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : null,
    });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return typeof next === "function" ? next() : next;
  };
  return { fetch, calls };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function session(accessToken: string): ClientSession {
  return { accessToken };
}

describe("the bearer token", () => {
  it("is read from the session again for every request", async () => {
    const tokens = ["first-token", "second-token"];
    const { fetch, calls } = scriptedFetch(json(200, []), json(200, []));
    const api = createApiClient({
      baseUrl: BASE_URL,
      fetch,
      getSession: async () => session(tokens.shift()!),
    });

    await api.get("/templates");
    await api.get("/templates");

    assert.equal(calls[0].headers.get("Authorization"), "Bearer first-token");
    assert.equal(calls[1].headers.get("Authorization"), "Bearer second-token");
    assert.equal(calls[0].url, `${BASE_URL}/templates`);
  });

  // Each session read can make the server refresh the token; a page's burst
  // of requests should cost one read, not one refresh per request.
  it("is read once for requests that start together", async () => {
    let reads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { fetch, calls } = scriptedFetch(json(200, []), json(200, []), json(200, []));
    const api = createApiClient({
      baseUrl: BASE_URL,
      fetch,
      getSession: async () => {
        reads += 1;
        await gate;
        return session("shared-token");
      },
    });

    const pending = [api.get("/templates"), api.get("/mailing_lists"), api.get("/mail_tasks")];
    release();
    await Promise.all(pending);

    assert.equal(reads, 1);
    assert.deepEqual(
      calls.map((call) => call.headers.get("Authorization")),
      ["Bearer shared-token", "Bearer shared-token", "Bearer shared-token"],
    );
  });

  it("is read afresh once the shared read has finished", async () => {
    let reads = 0;
    const { fetch } = scriptedFetch(json(200, []), json(200, []));
    const api = createApiClient({
      baseUrl: BASE_URL,
      fetch,
      getSession: async () => {
        reads += 1;
        return session(`token-${reads}`);
      },
    });

    await api.get("/templates");
    await api.get("/templates");

    assert.equal(reads, 2);
  });
});

describe("a successful answer", () => {
  const signedIn = async () => session("token");

  // SkyMail answers an archive and a recipient removal with 204 and no body.
  // The old data provider parsed that body as JSON, threw after the row was
  // already archived, and told the operator "Silinirken hata oluştu".
  for (const [name, path] of [
    ["Mail template arşivle", "/templates/11111111-1111-1111-1111-111111111111"],
    ["mail listesi arşivle", "/mailing_lists/22222222-2222-2222-2222-222222222222"],
    [
      "alıcı çıkar",
      "/mailing_lists/22222222-2222-2222-2222-222222222222/recipients/33333333-3333-3333-3333-333333333333",
    ],
  ] as const) {
    it(`with 204 and no body is a success: ${name}`, async () => {
      const { fetch, calls } = scriptedFetch(new Response(null, { status: 204 }));
      const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

      assert.equal(await api.delete(path), undefined);
      assert.equal(calls[0].method, "DELETE");
    });
  }

  it("with 200 and an empty body is a success", async () => {
    const { fetch } = scriptedFetch(new Response("", { status: 200 }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

    assert.equal(await api.post("/mailing_lists/1/restore"), undefined);
  });

  it("with a JSON body resolves to that body", async () => {
    const { fetch } = scriptedFetch(json(200, [{ id: "a", name: "Hoş geldin" }]));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

    assert.deepEqual(await api.get("/templates"), [{ id: "a", name: "Hoş geldin" }]);
  });

  it("follows a request that carried a JSON body and a query", async () => {
    const { fetch, calls } = scriptedFetch(json(201, { id: "new" }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

    const created = await api.post(
      "/mailing_lists",
      { name: "Duyurular" },
      { query: { lifecycle: "all", limit: 20, skipped: undefined } },
    );

    assert.deepEqual(created, { id: "new" });
    assert.equal(calls[0].url, `${BASE_URL}/mailing_lists?lifecycle=all&limit=20`);
    assert.equal(calls[0].headers.get("Content-Type"), "application/json");
    assert.equal(calls[0].body, JSON.stringify({ name: "Duyurular" }));
  });
});

describe("a page of a list", () => {
  const signedIn = async () => session("token");

  function page(body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(body === undefined ? "" : JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }

  // List routes page with _start/_end and put the size of the whole list in
  // X-Total-Count, so a pager can say how many pages there are.
  it("carries the rows and the total the API counted", async () => {
    const { fetch, calls } = scriptedFetch(page([{ id: "a" }, { id: "b" }], { "X-Total-Count": "42" }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

    const result = await api.getPage("/mail_tasks", { query: { status: "failed", _start: 0, _end: 2 } });

    assert.deepEqual(result, { items: [{ id: "a" }, { id: "b" }], total: 42 });
    assert.equal(calls[0].url, `${BASE_URL}/mail_tasks?status=failed&_start=0&_end=2`);
  });

  // A proxy that does not expose the header to the browser hides it; the page
  // then knows its rows but not how many pages follow.
  for (const [name, headers] of [
    ["no total", {}],
    ["a total that is not a count", { "X-Total-Count": "many" }],
    ["a negative total", { "X-Total-Count": "-1" }],
  ] as const) {
    it(`has no total when the answer carries ${name}`, async () => {
      const { fetch } = scriptedFetch(page([{ id: "a" }], headers));
      const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

      assert.deepEqual(await api.getPage("/mail_tasks"), { items: [{ id: "a" }], total: null });
    });
  }

  // skymail-backend encodes an empty sqlc result as null, not [].
  it("is empty when the API sends null for no rows", async () => {
    const { fetch } = scriptedFetch(page(null, { "X-Total-Count": "0" }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

    assert.deepEqual(await api.getPage("/mail_tasks/1/queue"), { items: [], total: 0 });
  });

  it("fails like any other request", async () => {
    const { fetch } = scriptedFetch(json(403, { code: "server.forbidden", message: "nope" }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

    const error = await api.getPage("/mail_tasks").catch((reason: unknown) => reason);

    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
  });
});

describe("a failed answer", () => {
  const signedIn = async () => session("token");

  async function failure(response: Response | (() => Response)): Promise<ApiError> {
    const { fetch } = scriptedFetch(response);
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });
    const error = await api.delete("/templates/1").then(
      () => assert.fail("expected the request to fail"),
      (reason: unknown) => reason,
    );
    assert.ok(error instanceof ApiError, `expected an ApiError, got ${String(error)}`);
    return error;
  }

  it("turns the API's code into a sentence the operator can act on", async () => {
    const error = await failure(
      json(409, { code: "template.system_protected", message: "System templates cannot be archived." }),
    );

    assert.equal(error.status, 409);
    assert.equal(error.code, "template.system_protected");
    assert.match(error.message, /System template arşivlenemez/);
    assert.equal(error.serverMessage, "System templates cannot be archived.");
  });

  it("carries the params the API sent with the error", async () => {
    const error = await failure(
      json(400, {
        code: "validation.error",
        message: "One or more validation errors occurred.",
        params: { errors: [{ field: "name", tag: "required" }] },
      }),
    );

    assert.match(error.message, /geçersiz/);
    assert.deepEqual(error.params, { errors: [{ field: "name", tag: "required" }] });
  });

  it("falls back to a sentence for the status when the code is unknown", async () => {
    const error = await failure(json(409, { code: "list.something_new", message: "Something new." }));

    assert.equal(error.code, "list.something_new");
    assert.match(error.message, /çakışıyor/);
    assert.equal(error.serverMessage, "Something new.");
  });

  it("explains a malformed Template key", async () => {
    const error = await failure(
      json(400, { code: "template.invalid_key", message: "A template key is 3–64 characters…" }),
    );

    assert.match(error.message, /Template key/);
    assert.match(error.message, /3–64/);
  });

  // A code is looked up by name; "constructor" or "toString" must not find
  // what every object inherits and print a function as the error.
  for (const code of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    it(`treats the code "${code}" as unknown`, async () => {
      const error = await failure(json(409, { code, message: "odd" }));

      assert.equal(typeof error.message, "string");
      assert.match(error.message, /çakışıyor/);
    });
  }

  it("does not choke on an error page that is not JSON", async () => {
    const error = await failure(
      new Response("<html><body>Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    );

    assert.equal(error.status, 502);
    assert.match(error.message, /yanıt vermiyor/);
  });

  it("reports a success whose body is not JSON as an unexpected answer", async () => {
    const { fetch } = scriptedFetch(new Response("<html>Giriş</html>", { status: 200 }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: signedIn });

    const error = await api.get("/templates").catch((reason: unknown) => reason);

    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 200);
    assert.match(error.message, /beklenmeyen/);
  });

  it("says the server could not be reached when there was no answer", async () => {
    const error = await failure(() => {
      throw new TypeError("fetch failed");
    });

    assert.equal(error.status, 0);
    assert.match(error.message, /ulaşılamadı/);
  });
});

describe("the end of a session", () => {
  it("is announced when the API answers 401, and the request fails with a sentence that says so", async () => {
    // What the gateway actually sends for an expired or unknown token.
    const { fetch } = scriptedFetch(
      new Response(null, { status: 401, headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' } }),
    );
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: async () => session("expired") });
    let announced = 0;
    api.onSessionEnded(() => (announced += 1));

    const error = await api.get("/templates").catch((reason: unknown) => reason);

    assert.equal(announced, 1);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.match(error.message, /Oturumun sona erdi/);
  });

  it("is announced without calling the API when the session could not be refreshed", async () => {
    const { fetch, calls } = scriptedFetch();
    const api = createApiClient({
      baseUrl: BASE_URL,
      fetch,
      getSession: async () => ({ accessToken: "stale", error: "RefreshAccessTokenError" }),
    });
    let announced = 0;
    api.onSessionEnded(() => (announced += 1));

    const error = await api.post("/mail_tasks", { template_id: "t" }).catch((reason: unknown) => reason);

    assert.equal(announced, 1);
    assert.equal(calls.length, 0);
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, "session.ended");
    assert.match(error.message, /Oturumun sona erdi/);
  });

  // Signing out in another tab, or /api/auth/session failing, leaves no
  // session at all. Sending the request anyway would go out without a bearer
  // and come back as a 401 the operator cannot act on.
  for (const [name, getSession] of [
    ["there is no session", async () => null],
    ["the session has no access token", async () => ({})],
  ] as const) {
    it(`is announced without calling the API when ${name}`, async () => {
      const { fetch, calls } = scriptedFetch();
      const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession });
      let announced = 0;
      api.onSessionEnded(() => (announced += 1));

      const error = await api.get("/templates").catch((reason: unknown) => reason);

      assert.equal(announced, 1);
      assert.equal(calls.length, 0);
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "session.ended");
      assert.match(error.message, /Oturumun sona erdi/);
    });
  }

  it("is not announced for a request the operator is simply not allowed to make", async () => {
    const { fetch } = scriptedFetch(
      json(403, { code: "server.forbidden", message: "You do not have permission to access this resource." }),
    );
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: async () => session("token") });
    let announced = 0;
    api.onSessionEnded(() => (announced += 1));

    const error = await api.get("/mail_tasks").catch((reason: unknown) => reason);

    assert.equal(announced, 0);
    assert.ok(error instanceof ApiError);
    assert.match(error.message, /yetkin yok/);
  });

  it("stops reaching a listener that unsubscribed", async () => {
    const { fetch } = scriptedFetch(new Response(null, { status: 401 }), new Response(null, { status: 401 }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, getSession: async () => session("expired") });
    let announced = 0;
    const unsubscribe = api.onSessionEnded(() => (announced += 1));

    await api.get("/templates").catch(() => undefined);
    unsubscribe();
    await api.get("/templates").catch(() => undefined);

    assert.equal(announced, 1);
  });
});
