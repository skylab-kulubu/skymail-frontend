import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROLE } from "./access";
import { TEST_BASE_URL, json, scriptedClient } from "./api/testing";
import {
  CONTENT_VIEWS_PAGE_SIZE,
  fetchContentViews,
  fetchViewedRecipients,
  readsContentViews,
  showsContentViews,
  viewerName,
} from "./content-views";
import { ERASED_PERSON, ERASED_SUBJECT } from "./people";

const SEND = "3f1c2b4a-1d2e-4f5a-8b9c-0d1e2f3a4b5c";

describe("who reads who opened masked content", () => {
  it("is the audit role, with SkyMail's access", () => {
    assert.equal(readsContentViews([ROLE.access, ROLE.auditRead]), true);
    assert.equal(readsContentViews([ROLE.auditRead]), false);
  });

  it("is not a role that opens the content", () => {
    // Those audited do not read their own record (Yusuf, 2026-11-22).
    assert.equal(readsContentViews([ROLE.access, ROLE.mailsRead, ROLE.mailsWrite, ROLE.mailsTrackingRead, "skymail:system-mails:read"]), false);
  });
});

describe("the section on a send's page", () => {
  it("shows on a masked send, empty or not, while it loads too", () => {
    assert.equal(showsContentViews(true, { status: "loading" }), true);
    assert.equal(showsContentViews(true, { status: "success", page: 1, rows: 0 }), true);
  });

  it("shows on any other send only once someone opened it masked", () => {
    // The audit reader may not open the content: the send reads restricted to them.
    assert.equal(showsContentViews(false, { status: "loading" }), false);
    assert.equal(showsContentViews(false, { status: "success", page: 1, rows: 0 }), false);
    assert.equal(showsContentViews(false, { status: "success", page: 1, rows: 2 }), true);
    assert.equal(showsContentViews(false, { status: "success", page: 2, rows: 0 }), true);
  });

  it("hides when the route is not there or the role was taken away, and shows any other failure", () => {
    assert.equal(showsContentViews(true, { status: "error", code: 404 }), false);
    assert.equal(showsContentViews(true, { status: "error", code: 403 }), false);
    assert.equal(showsContentViews(false, { status: "error", code: 500 }), true);
  });
});

describe("the openings", () => {
  it("are asked a page at a time", async () => {
    const { api, calls } = scriptedClient(json(200, [], { "X-Total-Count": "0" }));
    const page = await fetchContentViews(api, SEND, 2);
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks/${SEND}/content-views?_start=${CONTENT_VIEWS_PAGE_SIZE}&_end=${2 * CONTENT_VIEWS_PAGE_SIZE}`);
    assert.deepEqual(page, { items: [], total: 0 });
  });

  it("are not asked for a malformed send", async () => {
    const { api, calls } = scriptedClient();
    await assert.rejects(fetchContentViews(api, "bozuk", 1), (error: { status?: number }) => error.status === 404);
    assert.equal(calls.length, 0);
  });

  it("name the opener, or Silinmiş kullanıcı once their account was erased", () => {
    assert.equal(viewerName({ sub: "a", name: " Ece Yıldız " }), "Ece Yıldız");
    assert.equal(viewerName({ sub: ERASED_SUBJECT, name: ERASED_PERSON }), ERASED_PERSON);
    assert.equal(viewerName({ sub: null, name: null }), "Adı bilinmiyor");
  });
});

describe("the recipients of the opened rows", () => {
  const row = (id: string, name: string, email: string) => ({
    id,
    recipient_full_name: name,
    recipient_email: email,
    status: null,
    error: null,
    attempts: 1,
    next_attempt_at: null,
    created_at: null,
  });

  it("are found in the send's rows, and the reading stops once each is", async () => {
    const full = Array.from({ length: 100 }, (_, i) => row(`r${i}`, `Kişi ${i}`, `kisi${i}@example.com`));
    const { api, calls } = scriptedClient(json(200, full));
    const names = await fetchViewedRecipients(api, SEND, ["r3", "r40"]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks/${SEND}/queue?_start=0&_end=100`);
    assert.deepEqual([...names], [["r3", "Kişi 3"], ["r40", "Kişi 40"]]);
  });

  it("are read for at most five pages; one not found has no name", async () => {
    const page = (n: number) => json(200, Array.from({ length: 100 }, (_, i) => row(`p${n}-${i}`, "Ad", "ad@example.com")));
    const { api, calls } = scriptedClient(page(1), page(2), page(3), page(4), page(5));
    const names = await fetchViewedRecipients(api, SEND, ["yok"]);
    assert.equal(calls.length, 5);
    assert.equal(names.size, 0);
  });

  it("stop at the last page", async () => {
    const { api, calls } = scriptedClient(json(200, [row("tek", "", "silinmis-kullanici@invalid")]));
    const names = await fetchViewedRecipients(api, SEND, ["tek", "baska"]);
    assert.equal(calls.length, 1);
    assert.equal(names.get("tek"), ERASED_PERSON);
  });
});
