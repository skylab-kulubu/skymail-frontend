/**
 * "Haberden gönder" (hub ticket duyuru-haber 08): the address the panel and
 * the site open, what the form sends to skymail-backend's /news_sends routes
 * (06, 07), the live count's breakdown and what stops a send.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./api/errors";
import { json, scriptedClient, TEST_BASE_URL } from "./api/testing";
import {
  countFor,
  countParts,
  emptyNewsDraft,
  fetchNewsAvailability,
  fetchNewsCount,
  mailLinks,
  newsAccess,
  newsCountRequest,
  newsSendHref,
  newsSendRequest,
  previewNewsMail,
  readNewsSendQuery,
  sendNews,
  sendProblems,
  teamOptions,
  testNewsMail,
  type NewsSendCount,
} from "./news-send";
import { COMMERCIAL_STATEMENT } from "./send-form/purpose";

const count = (overrides: Partial<NewsSendCount["counts"]> = {}, alreadySent: string | null = null): NewsSendCount => ({
  counts: {
    members: 180,
    followers: 12,
    total: 192,
    already_received: 0,
    skipped: { not_member: 0, not_visible: 0, disabled: 2, no_email: 1, unverified: 3, opted_out: 9, duplicate_email: 0, no_unsubscribe_url: 0 },
    ...overrides,
  },
  already_sent_task_id: alreadySent,
  source: { ref: "news:bahar-kayitlari", slug: "bahar-kayitlari", version: 3, kind: "duyuru" },
});

describe("the address", () => {
  it("is the send form with source=news and the slug", () => {
    assert.equal(newsSendHref("bahar-kayitlari"), "/mail-tasks/create?source=news&slug=bahar-kayitlari");
    assert.equal(newsSendHref("a b/c"), "/mail-tasks/create?source=news&slug=a+b%2Fc");
  });

  it("reads the slug, and says what is wrong with a bad one", () => {
    assert.equal(readNewsSendQuery(new URLSearchParams("mail_list_id=x")), null);
    assert.deepEqual(readNewsSendQuery(new URLSearchParams("source=news&slug=%20bahar-kayitlari%20")), { slug: "bahar-kayitlari" });
    assert.deepEqual(readNewsSendQuery(new URLSearchParams("source=news")), { slug: "" });
    const long = readNewsSendQuery(new URLSearchParams(`source=news&slug=${"a".repeat(201)}`));
    assert.ok(long && "problem" in long && long.problem.includes("200"));
  });
});

describe("who may do what", () => {
  it("sends with skymail:announcements:send, prepares with skymail:mails:write", () => {
    assert.deepEqual(newsAccess(["skymail:access", "skymail:announcements:send"]), { prepare: true, send: true });
    assert.deepEqual(newsAccess(["skymail:access", "skymail:mails:write"]), { prepare: true, send: false });
    assert.deepEqual(newsAccess(["skymail:access", "skymail:mails:read"]), { prepare: false, send: false });
  });
});

describe("what goes to the API", () => {
  const draft = {
    ...emptyNewsDraft("bahar-kayitlari"),
    audience: { type: "teams" as const, teams: ["g-airlab", "g-algolab"] },
    format: "summary" as const,
    subject: "  Kayıtlar açıldı  ",
    preheader: " ",
    statement: true,
  };

  it("sends the record, the audience, the format, trimmed texts and the statement", () => {
    assert.deepEqual(newsSendRequest(draft), {
      slug: "bahar-kayitlari",
      audience: { type: "teams", teams: ["g-airlab", "g-algolab"] },
      format: "summary",
      subject: "Kayıtlar açıldı",
      preheader: "",
      commercial_content_absent: true,
      tracking: false,
    });
    assert.deepEqual(newsSendRequest({ ...draft, audience: { type: "members", teams: ["g-airlab"] } }).audience, { type: "members", teams: [] });
    assert.equal(newsSendRequest({ ...draft, statement: false }).commercial_content_absent, false);
    assert.deepEqual(newsCountRequest(draft), { slug: "bahar-kayitlari", audience: { type: "teams", teams: ["g-airlab", "g-algolab"] } });
  });

  it("calls the routes skymail-backend serves", async () => {
    const { api, calls } = scriptedClient(
      json(200, { available: true, read_more: "pages" }),
      json(200, { subject: "Duyuru: Kayıtlar", plain_text: "x", html: "<p>x</p>" }),
      json(200, count()),
      json(201, { id: "t1" }),
      json(201, { id: "s1", source: count().source, queued: 170, failed: 0, counts: count().counts }),
    );
    assert.deepEqual(await fetchNewsAvailability(api), { available: true, read_more: "pages" });
    assert.equal((await previewNewsMail(api, draft)).subject, "Duyuru: Kayıtlar");
    assert.equal((await fetchNewsCount(api, draft)).counts.total, 192);
    assert.equal((await testNewsMail(api, draft)).id, "t1");
    assert.equal((await sendNews(api, draft)).id, "s1");
    assert.deepEqual(
      calls.map((call) => `${call.method} ${call.url.replace(TEST_BASE_URL, "")}`),
      ["GET /news_sends/availability", "POST /news_sends/preview", "POST /news_sends/count", "POST /news_sends/test", "POST /news_sends"],
    );
    assert.deepEqual(JSON.parse(calls[2].body ?? "{}"), newsCountRequest(draft));
  });
});

describe("the team picker", () => {
  it("offers the Keycloak groups under /UYELER, by name with the path as the hint", () => {
    const rows = [
      { id: "l1", name: "Tüm üyeler", external: false, groupPath: null, createdAt: "x", archivedAt: null },
      { id: "g1", name: "AIRLAB", external: true, groupPath: "/UYELER/ARGE/AIRLAB", createdAt: null, archivedAt: null },
      { id: "g2", name: "YK", external: true, groupPath: "/YONETIM/YK", createdAt: null, archivedAt: null },
      { id: "g3", name: "ALGOLAB", external: true, groupPath: "/UYELER/ARGE/ALGOLAB", createdAt: null, archivedAt: null },
    ];
    assert.deepEqual(teamOptions(rows), [
      { value: "g1", label: "AIRLAB", hint: "/UYELER/ARGE/AIRLAB" },
      { value: "g3", label: "ALGOLAB", hint: "/UYELER/ARGE/ALGOLAB" },
    ]);
  });
});

describe("the links in the mail", () => {
  it("are listed once each, as the review shows them", () => {
    const html = `<a href="https://yildizskylab.com/haberler/bahar?x=1&amp;y=2">Oku</a> <a class="c" href='https://yildizskylab.com/haberler/bahar?x=1&amp;y=2'>tekrar</a>
      <a href="https://my.yildizskylab.com/iletisim">Tercihler</a><a name="top">yok</a>`;
    assert.deepEqual(mailLinks(html), ["https://yildizskylab.com/haberler/bahar?x=1&y=2", "https://my.yildizskylab.com/iletisim"]);
  });
});

describe("the live count", () => {
  it("shows who it reaches and who it leaves out, the non-zero ones", () => {
    assert.deepEqual(countParts(count({ already_received: 40 })), [
      { key: "members", label: "Üyeler", value: 180 },
      { key: "followers", label: "Takipçiler", value: 12 },
      { key: "opted_out", label: "Tercihi kapalı", value: 9 },
      { key: "not_visible", label: "Görünürlük dışı", value: 0 },
      { key: "already_received", label: "Zaten aldı", value: 40 },
      { key: "unverified", label: "Doğrulanmamış", value: 3 },
      { key: "disabled", label: "Devre dışı", value: 2 },
      { key: "no_email", label: "Adresi yok", value: 1 },
    ]);
  });
});

describe("what stops a send", () => {
  const ready = { ...emptyNewsDraft("bahar-kayitlari"), statement: true };

  it("is nothing for a ready draft with people to reach", () => {
    assert.deepEqual(sendProblems(ready, count()), []);
  });

  it("is the statement box, unchecked", () => {
    assert.deepEqual(sendProblems({ ...ready, statement: false }, count()), [`Beyan kutusunu işaretle: “${COMMERCIAL_STATEMENT}”`]);
  });

  it("is a team audience with no team, or too many", () => {
    assert.match(sendProblems({ ...ready, audience: { type: "teams", teams: [] } }, count())[0], /en az bir ekip/);
    const many = Array.from({ length: 33 }, (_, i) => `g${i}`);
    assert.match(sendProblems({ ...ready, audience: { type: "teams", teams: many } }, count())[0], /en çok 32/);
  });

  it("is a subject or a preview text too long", () => {
    assert.match(sendProblems({ ...ready, subject: "a".repeat(201) }, count())[0], /Konu en çok 200/);
    assert.match(sendProblems({ ...ready, preheader: "a".repeat(301) }, count())[0], /Önizleme metni en çok 300/);
  });

  it("is the count not there yet, nobody to reach, or this audience already sent to", () => {
    assert.match(sendProblems(ready, null)[0], /sayı/);
    assert.match(sendProblems(ready, count({ members: 0, followers: 0, total: 0 }))[0], /kimse yok/);
    assert.match(sendProblems(ready, count({}, "task-1"))[0], /zaten gönderildi/);
  });
});

describe("the count a send reads", () => {
  const members = { ...emptyNewsDraft("bahar-kayitlari"), statement: true };
  const teams = { ...members, audience: { type: "teams" as const, teams: ["g1"] } };

  it("is the count of the draft's audience", () => {
    assert.deepEqual(countFor(members, { ...members, subject: "Yeni konu" }, count()), count());
  });

  it("is none while the count is an older audience's: the send waits for the new one", () => {
    assert.equal(countFor(teams, members, count()), null);
    assert.equal(countFor({ ...teams, audience: { type: "teams", teams: ["g1", "g2"] } }, teams, count()), null);
    assert.match(sendProblems(teams, countFor(teams, members, count()))[0], /sayı/);
  });
});

describe("errors", () => {
  it("speak of the record and the send in Turkish", () => {
    assert.match(new ApiError(404, "news_send.not_found").message, /yayımlanmış/);
    assert.match(new ApiError(503, "news_send.not_enabled").message, /kapalı/);
    assert.match(new ApiError(409, "news_send.already_sent").message, /zaten/);
    assert.match(new ApiError(429, "news_send.test_rate_limited").message, /dakikada en çok 3/);
    assert.match(new ApiError(409, "mail_task.finished").message, /bitti/);
  });
});
