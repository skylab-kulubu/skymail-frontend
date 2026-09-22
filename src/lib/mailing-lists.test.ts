/**
 * Mailing lists as the operator sees them, driven through the one HTTP client
 * with a scripted fetch that answers the way skymail-backend `origin/main`
 * does (`internal/handlers/list.go`): which request each screen sends, and
 * which rows, tags and actions come out of the answer.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApiClient } from "./api/client";
import {
  LIST_PAGE_SIZE,
  RECIPIENT_PAGE_SIZE,
  addRecipient,
  archiveList,
  createList,
  fetchList,
  fetchListPage,
  fetchRecipientPage,
  isListId,
  listActions,
  removeRecipient,
  renameList,
  restoreList,
  toListRow,
  validateListName,
  validateRecipient,
  type MailingList,
  type Recipient,
} from "./mailing-lists";

const BASE_URL = "https://api.example.test/api/skymail/v1";

type Call = { url: string; method: string; body: string | null };

function scriptedApi(...responses: Response[]) {
  const calls: Call[] = [];
  const api = createApiClient({
    baseUrl: BASE_URL,
    getSession: async () => ({ accessToken: "token" }),
    fetch: async (input, init) => {
      calls.push({
        url: String(input).replace(BASE_URL, ""),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
      });
      const next = responses.shift();
      if (!next) throw new Error(`unexpected request ${String(input)}`);
      return next;
    },
  });
  return { api, calls };
}

function answer(status: number, body: unknown, total?: number): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (total !== undefined) headers["X-Total-Count"] = String(total);
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

const ID = {
  beta: "11111111-1111-4111-8111-111111111111",
  old: "22222222-2222-4222-8222-222222222222",
  weblab: "33333333-3333-4333-8333-333333333333",
  arge: "44444444-4444-4444-8444-444444444444",
  ayse: "55555555-5555-4555-8555-555555555555",
};

function internal(id: string, name: string, archivedAt: string | null = null): MailingList {
  return {
    id,
    name,
    description: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    source: "internal",
    ...(archivedAt ? { archived_at: archivedAt, archived_by: "kc-subject" } : {}),
  };
}

// The backend fills a group's timestamps with the time of the request.
function group(id: string, name: string, path: string): MailingList {
  return {
    id,
    name,
    description: path,
    created_at: "2026-09-23T12:00:00Z",
    updated_at: "2026-09-23T12:00:00Z",
    source: "keycloak",
  };
}

function recipient(n: number): Recipient {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    full_name: `Üye ${n}`,
    email: `uye${n}@example.test`,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
  };
}

describe("a row of the list screen", () => {
  it("shows an internal list by name with its creation time", () => {
    assert.deepEqual(toListRow(internal(ID.beta, "Beta Kullanıcıları")), {
      id: ID.beta,
      name: "Beta Kullanıcıları",
      external: false,
      groupPath: null,
      createdAt: "2026-09-01T10:00:00Z",
      archivedAt: null,
    });
  });

  // The group path arrives as the description; the backend's timestamps for
  // a group are the time of the request, so they are not shown.
  it("shows a Keycloak group as external, with its path and no creation time", () => {
    assert.deepEqual(toListRow(group(ID.weblab, "WEBLAB", "/UYELER/ARGE/WEBLAB")), {
      id: ID.weblab,
      name: "WEBLAB",
      external: true,
      groupPath: "/UYELER/ARGE/WEBLAB",
      createdAt: null,
      archivedAt: null,
    });
  });

  it("marks an archived internal list with the time it was archived", () => {
    const row = toListRow(internal(ID.old, "Eski Duyurular", "2026-09-20T08:30:00Z"));
    assert.equal(row.archivedAt, "2026-09-20T08:30:00Z");
    assert.equal(row.external, false);
  });

  // Only "internal" is writable in SkyMail; a source the panel does not know
  // yet is treated like a group rather than offered actions that would fail.
  it("treats a source it does not know as external", () => {
    assert.equal(toListRow({ ...internal(ID.beta, "X"), source: "forms" }).external, true);
  });
});

describe("the actions on a row", () => {
  const current = toListRow(internal(ID.beta, "Beta"));
  const archived = toListRow(internal(ID.old, "Eski", "2026-09-20T08:30:00Z"));
  const keycloak = toListRow(group(ID.weblab, "WEBLAB", "/UYELER/ARGE/WEBLAB"));

  it("let a writer open, rename and archive a current internal list", () => {
    assert.deepEqual(listActions(current, true), ["show", "edit", "archive"]);
  });

  // The API hides an archived list from every read, so it cannot be opened.
  it("let a writer only restore an archived list", () => {
    assert.deepEqual(listActions(archived, true), ["restore"]);
  });

  it("only open a Keycloak group, whoever is looking", () => {
    assert.deepEqual(listActions(keycloak, true), ["show"]);
    assert.deepEqual(listActions(keycloak, false), ["show"]);
  });

  it("offer a reader nothing that writes", () => {
    assert.deepEqual(listActions(current, false), ["show"]);
    assert.deepEqual(listActions(archived, false), []);
  });
});

describe("a page of the list screen", () => {
  it("asks for the filter and the page's slice", async () => {
    const { api, calls } = scriptedApi(answer(200, [], 0));

    await fetchListPage(api, { lifecycle: "inactive", page: 2 });

    assert.equal(calls[0].url, `/mailing_lists?lifecycle=inactive&_start=${LIST_PAGE_SIZE}&_end=${2 * LIST_PAGE_SIZE}`);
  });

  it("shows internal lists first, then the Keycloak groups, with the API's total", async () => {
    const { api } = scriptedApi(
      answer(
        200,
        [internal(ID.beta, "Beta"), group(ID.weblab, "WEBLAB", "/UYELER/ARGE/WEBLAB"), group(ID.arge, "ARGE", "/UYELER/ARGE")],
        3,
      ),
    );

    const page = await fetchListPage(api, { lifecycle: "current", page: 1 });

    assert.deepEqual(
      page.rows.map((row) => [row.name, row.external]),
      [
        ["Beta", false],
        ["WEBLAB", true],
        ["ARGE", true],
      ],
    );
    assert.equal(page.total, 3);
  });

  // The API pages internal lists with _start/_end but appends every Keycloak
  // group to every page, and counts them once in X-Total-Count. Read as one
  // list — internal lists, then groups — each group belongs on one page only.
  it("does not repeat the Keycloak groups on a page of internal lists", async () => {
    const internals = Array.from({ length: LIST_PAGE_SIZE }, (_, i) =>
      internal(`aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`, `Liste ${i}`),
    );
    const groups = [group(ID.weblab, "WEBLAB", "/UYELER/ARGE/WEBLAB"), group(ID.arge, "ARGE", "/UYELER/ARGE")];
    const { api } = scriptedApi(answer(200, [...internals, ...groups], LIST_PAGE_SIZE + 5 + groups.length));

    const page = await fetchListPage(api, { lifecycle: "current", page: 1 });

    assert.equal(page.rows.length, LIST_PAGE_SIZE);
    assert.ok(page.rows.every((row) => !row.external));
  });

  it("puts the Keycloak groups after the last internal lists", async () => {
    const lastInternals = [internal(ID.beta, "Liste 25"), internal(ID.old, "Liste 26")];
    const groups = [group(ID.weblab, "WEBLAB", "/UYELER/ARGE/WEBLAB"), group(ID.arge, "ARGE", "/UYELER/ARGE")];
    // 27 internal lists and 2 groups; page 2 holds internal 25–26 and both groups.
    const { api } = scriptedApi(answer(200, [...lastInternals, ...groups], 27 + 2));

    const page = await fetchListPage(api, { lifecycle: "current", page: 2 });

    assert.deepEqual(
      page.rows.map((row) => row.name),
      ["Liste 25", "Liste 26", "WEBLAB", "ARGE"],
    );
    assert.equal(page.total, 29);
  });

  it("splits the Keycloak groups across pages when they overflow one", async () => {
    const groups = Array.from({ length: 30 }, (_, i) =>
      group(`bbbbbbbb-0000-4000-8000-${String(i).padStart(12, "0")}`, `Grup ${i}`, `/G/${i}`),
    );
    // No internal lists: page 1 is groups 0–24, page 2 is groups 25–29.
    const first = scriptedApi(answer(200, groups, 30));
    const second = scriptedApi(answer(200, groups, 30));

    const one = await fetchListPage(first.api, { lifecycle: "all", page: 1 });
    const two = await fetchListPage(second.api, { lifecycle: "all", page: 2 });

    assert.deepEqual(one.rows.map((row) => row.name), groups.slice(0, 25).map((g) => g.name));
    assert.deepEqual(two.rows.map((row) => row.name), groups.slice(25).map((g) => g.name));
  });

  // Without X-Total-Count (a proxy that does not expose it) the page cannot
  // be placed in the whole list; it shows what came back, once, and no pager.
  it("shows every row it got when the answer has no total", async () => {
    const { api } = scriptedApi(answer(200, [internal(ID.beta, "Beta"), group(ID.weblab, "WEBLAB", "/W")]));

    const page = await fetchListPage(api, { lifecycle: "current", page: 1 });

    assert.deepEqual(page.rows.map((row) => row.name), ["Beta", "WEBLAB"]);
    assert.equal(page.total, 2);
  });
});

describe("one list", () => {
  it("is read by its id", async () => {
    const { api, calls } = scriptedApi(answer(200, group(ID.weblab, "WEBLAB", "/UYELER/ARGE/WEBLAB")));

    const list = await fetchList(api, ID.weblab);

    assert.equal(calls[0].url, `/mailing_lists/${ID.weblab}`);
    assert.equal(list.name, "WEBLAB");
  });

  // The API answers a malformed id with a 500; a link with a broken id is a
  // missing list, not a server error, and needs no request.
  it("is not found, without asking the API, when the id is not one", async () => {
    const { api, calls } = scriptedApi();

    const error = await fetchList(api, "not-a-list").catch((reason: unknown) => reason);

    assert.equal((error as { status?: number }).status, 404);
    assert.equal(calls.length, 0);
  });

  it("recognises list ids as the UUIDs Keycloak and Postgres hand out", () => {
    assert.equal(isListId(ID.beta), true);
    assert.equal(isListId(ID.beta.toUpperCase()), true);
    assert.equal(isListId("123"), false);
    assert.equal(isListId(`${ID.beta}/recipients`), false);
  });
});

describe("the recipients of a list", () => {
  it("are paged by the API for an internal list", async () => {
    const rows = [recipient(26), recipient(27)];
    const { api, calls } = scriptedApi(answer(200, rows, 27));

    const page = await fetchRecipientPage(api, { id: ID.beta, external: false }, 2);

    assert.equal(
      calls[0].url,
      `/mailing_lists/${ID.beta}/recipients?_start=${RECIPIENT_PAGE_SIZE}&_end=${2 * RECIPIENT_PAGE_SIZE}`,
    );
    assert.deepEqual(page, { recipients: rows, total: 27 });
  });

  // An empty internal list answers null (an empty sqlc result).
  it("are none for an empty list", async () => {
    const { api } = scriptedApi(answer(200, null, 0));

    assert.deepEqual(await fetchRecipientPage(api, { id: ID.beta, external: false }, 1), {
      recipients: [],
      total: 0,
    });
  });

  // A Keycloak group answers with every member at once and ignores the range.
  it("are paged in the panel for a Keycloak group", async () => {
    const members = Array.from({ length: 30 }, (_, i) => recipient(i + 1));
    const first = scriptedApi(answer(200, members, 30));
    const second = scriptedApi(answer(200, members, 30));

    const one = await fetchRecipientPage(first.api, { id: ID.weblab, external: true }, 1);
    const two = await fetchRecipientPage(second.api, { id: ID.weblab, external: true }, 2);

    assert.deepEqual(one, { recipients: members.slice(0, RECIPIENT_PAGE_SIZE), total: 30 });
    assert.deepEqual(two, { recipients: members.slice(RECIPIENT_PAGE_SIZE), total: 30 });
  });
});

describe("changing a list", () => {
  it("creates a list with the trimmed name", async () => {
    const { api, calls } = scriptedApi(answer(201, internal(ID.beta, "Beta")));

    const created = await createList(api, "  Beta  ");

    assert.deepEqual([calls[0].method, calls[0].url, calls[0].body], ["POST", "/mailing_lists", '{"name":"Beta"}']);
    assert.equal(created.id, ID.beta);
  });

  it("renames a list", async () => {
    const { api, calls } = scriptedApi(answer(200, internal(ID.beta, "Gama")));

    await renameList(api, ID.beta, "Gama ");

    assert.deepEqual([calls[0].method, calls[0].url, calls[0].body], ["PATCH", `/mailing_lists/${ID.beta}`, '{"name":"Gama"}']);
  });

  // Archiving answers 204 with no body; that is a success.
  it("archives a list with DELETE and succeeds on 204", async () => {
    const { api, calls } = scriptedApi(new Response(null, { status: 204 }));

    await archiveList(api, ID.beta);

    assert.deepEqual([calls[0].method, calls[0].url], ["DELETE", `/mailing_lists/${ID.beta}`]);
  });

  it("restores an archived list", async () => {
    const { api, calls } = scriptedApi(answer(200, internal(ID.old, "Eski")));

    await restoreList(api, ID.old);

    assert.deepEqual([calls[0].method, calls[0].url], ["POST", `/mailing_lists/${ID.old}/restore`]);
  });

  it("adds a recipient with the trimmed name and address", async () => {
    const { api, calls } = scriptedApi(answer(201, recipient(1)));

    await addRecipient(api, ID.beta, { full_name: " Ayşe Yılmaz ", email: " ayse@example.test " });

    assert.equal(calls[0].url, `/mailing_lists/${ID.beta}/recipients`);
    assert.deepEqual(JSON.parse(calls[0].body!), { full_name: "Ayşe Yılmaz", email: "ayse@example.test" });
  });

  it("removes a recipient and succeeds on 204", async () => {
    const { api, calls } = scriptedApi(new Response(null, { status: 204 }));

    await removeRecipient(api, ID.beta, ID.ayse);

    assert.deepEqual([calls[0].method, calls[0].url], ["DELETE", `/mailing_lists/${ID.beta}/recipients/${ID.ayse}`]);
  });

  it("reports an API error in the client's Turkish", async () => {
    const { api } = scriptedApi(answer(404, { code: "server.not_found", message: "The requested resource was not found." }));

    const error = await archiveList(api, ID.beta).catch((reason: unknown) => reason);

    assert.equal((error as Error).message, "Aradığın kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir.");
  });
});

describe("what the forms accept", () => {
  it("needs a list name", () => {
    assert.equal(validateListName("Beta"), null);
    assert.equal(validateListName("   "), "Liste adını gir.");
  });

  it("needs a recipient's name and a plausible e-mail address", () => {
    assert.deepEqual(validateRecipient({ full_name: "Ayşe", email: "ayse@example.test" }), {});
    assert.deepEqual(validateRecipient({ full_name: " ", email: "" }), {
      full_name: "Ad soyad gir.",
      email: "E-posta adresi gir.",
    });
    assert.deepEqual(validateRecipient({ full_name: "Ayşe", email: "ayse.example.test" }), {
      email: "Geçerli bir e-posta adresi gir.",
    });
    assert.deepEqual(validateRecipient({ full_name: "Ayşe", email: "ayse @example.test" }), {
      email: "Geçerli bir e-posta adresi gir.",
    });
  });
});
