/**
 * A Mail template's version history as the operator reads it (ticket 14,
 * stories 37–39): which requests the page sends, who wrote each version and
 * how it stands, which two versions a comparison puts side by side and what it
 * says differs, and what a restore did — driven through the one HTTP client
 * with a scripted fetch that answers as skymail-backend's version routes do
 * (`GET …/versions`, `POST …/versions/{id}/restore`, feat/seed-conflict).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEST_BASE_URL, json, scriptedClient, type RecordedCall } from "../api/testing";
import { fetchVersionPage, restoreVersion, templateHref, type TemplateVersion, type TemplateVersionSummary } from "../templates";
import {
  HISTORY_PAGE_SIZE,
  comparedVariables,
  comparisonFacts,
  defaultComparison,
  historyQuery,
  historyViewHref,
  inSeqOrder,
  readHistoryView,
  requestedSubject,
  restoreOutcome,
  togglePick,
  versionAuthor,
  versionBadge,
  versionName,
  versionWhen,
} from "./history";

const TEMPLATE = "7e3a1c00-0000-4000-8000-000000000001";
const VIEWER = "f3b1c7aa-0000-4000-8000-000000000001";
const OTHER = "f3b1c7aa-0000-4000-8000-000000000002";

const pathOf = (call: RecordedCall) => call.url.slice(TEST_BASE_URL.length);

/** Version ids by seq: v(3) is the third version. */
const v = (seq: number) => `9a1b2c00-0000-4000-8000-${String(seq).padStart(12, "0")}`;

function summary(seq: number, overrides: Partial<TemplateVersionSummary> = {}): TemplateVersionSummary {
  return {
    id: v(seq),
    template_id: TEMPLATE,
    seq,
    name: "Hoş geldin",
    subject: "SKY LAB'e hoş geldin",
    requested_subject: null,
    main_mode: "jsx",
    author: { kind: "operator", sub: OTHER, name: "Mehmet Kaya" },
    created_at: "2026-09-22T07:12:00Z",
    published_at: "2026-09-22T07:12:00Z",
    base_version_id: seq > 1 ? v(seq - 1) : null,
    current: false,
    discarded: false,
    ...overrides,
  };
}

function version(seq: number, overrides: Partial<TemplateVersion> = {}): TemplateVersion {
  return {
    ...summary(seq),
    jsx_source: "export default function Mail() { return null; }",
    visual_source: null,
    html_source: null,
    html_content: "<p>Merhaba</p>",
    plain_text_content: "Merhaba",
    ...overrides,
  };
}

describe("the history's view", () => {
  it("is every version, first page, when the address says nothing", () => {
    assert.deepEqual(readHistoryView(new URLSearchParams("")), { state: "all", page: 1 });
  });

  it("reads the state filter and the page from the address", () => {
    assert.deepEqual(readHistoryView(new URLSearchParams("state=draft&page=3")), { state: "draft", page: 3 });
    assert.deepEqual(readHistoryView(new URLSearchParams("state=published")), { state: "published", page: 1 });
  });

  it("falls back to the default for anything it does not recognise", () => {
    assert.deepEqual(readHistoryView(new URLSearchParams("state=discarded&page=0")), { state: "all", page: 1 });
    assert.deepEqual(readHistoryView(new URLSearchParams("page=-2&state=")), { state: "all", page: 1 });
  });

  it("writes an address that leaves the defaults out", () => {
    const path = templateHref.history(TEMPLATE);
    assert.equal(path, `/templates/history/${TEMPLATE}`);
    assert.equal(historyViewHref(path, { state: "all", page: 1 }), path);
    assert.equal(historyViewHref(path, { state: "draft", page: 2 }), `${path}?state=draft&page=2`);
  });

  it("asks the API for the filter and the page's slice", () => {
    assert.deepEqual(historyQuery({ state: "published", page: 2 }), {
      state: "published",
      _start: HISTORY_PAGE_SIZE,
      _end: 2 * HISTORY_PAGE_SIZE,
    });
  });
});

describe("a page of the history", () => {
  it("asks the versions route with the state and the slice, and hands over the API's total", async () => {
    const rows = [summary(3, { current: true }), summary(2), summary(1)];
    const { api, calls } = scriptedClient(json(200, rows, { "X-Total-Count": "23" }));

    const page = await fetchVersionPage(api, TEMPLATE, historyQuery({ state: "all", page: 1 }));

    assert.equal(pathOf(calls[0]), `/templates/${TEMPLATE}/versions?state=all&_start=0&_end=${HISTORY_PAGE_SIZE}`);
    assert.equal(calls[0].method, "GET");
    assert.deepEqual(page, { versions: rows, total: 23 });
  });

  it("counts what came back when the answer has no total", async () => {
    const { api } = scriptedClient(json(200, [summary(1)]));

    const page = await fetchVersionPage(api, TEMPLATE, { state: "draft", _start: 20, _end: 40 });

    assert.equal(page.total, 21);
  });
});

describe("who wrote a version", () => {
  it("is an operator, by name", () => {
    assert.deepEqual(versionAuthor(summary(4), VIEWER), {
      label: "Mehmet Kaya",
      kind: "operator",
      mine: false,
      beforeHistory: false,
    });
  });

  it("is marked as the viewer's own", () => {
    const mine = summary(4, { author: { kind: "operator", sub: VIEWER, name: "Ada Yılmaz" } });
    assert.deepEqual(versionAuthor(mine, VIEWER), { label: "Ada Yılmaz (sen)", kind: "operator", mine: true, beforeHistory: false });
  });

  // The seed's token has a name of its own (a service account); what counts is that a seed wrote it.
  it("is the Template seed, whatever name its token carried", () => {
    const seeded = summary(2, { author: { kind: "template_seed", sub: "svc-1", name: "service-account-skymail-seed" } });
    assert.deepEqual(versionAuthor(seeded, VIEWER), { label: "Template seed", kind: "seed", mine: false, beforeHistory: false });
  });

  it("is an operator nobody recorded the name of", () => {
    const nameless = summary(5, { author: { kind: "operator", sub: OTHER, name: "  " } });
    assert.deepEqual(versionAuthor(nameless, VIEWER), {
      label: "Adı bilinmeyen operatör",
      kind: "unknown",
      mine: false,
      beforeHistory: false,
    });
  });

  // Ticket 04's migration: one first version per template, with no sub and no name.
  it("is unknown, and older than the history, for a template's migrated first version", () => {
    const migrated = summary(1, { author: { kind: "operator", sub: null, name: null } });
    assert.deepEqual(versionAuthor(migrated, VIEWER), {
      label: "Adı bilinmeyen operatör",
      kind: "unknown",
      mine: false,
      beforeHistory: true,
    });
    const seeded = summary(1, { author: { kind: "template_seed", sub: null, name: null } });
    assert.deepEqual(versionAuthor(seeded, VIEWER), { label: "Template seed", kind: "seed", mine: false, beforeHistory: true });
  });

  // Only the migration wrote a first version with no one on record; a later one without a subject is not older than the history.
  it("is not older than the history for a later version with no subject on record", () => {
    const later = summary(3, { author: { kind: "template_seed", sub: null, name: null } });
    assert.equal(versionAuthor(later, VIEWER).beforeHistory, false);
  });

  it("is never the viewer's when the viewer has no subject", () => {
    const nameless = summary(1, { author: { kind: "operator", sub: null, name: null } });
    assert.equal(versionAuthor(nameless, null).mine, false);
  });
});

describe("how a version stands", () => {
  it("is the one being sent", () => {
    assert.deepEqual(versionBadge(summary(3, { current: true }), []), { state: "sent", label: "Gönderilen", inProgress: false });
  });

  it("is published, and no longer sent", () => {
    assert.deepEqual(versionBadge(summary(2), []), { state: "published", label: "Yayımlanmış", inProgress: false });
  });

  it("is someone's draft in progress", () => {
    const draft = summary(5, { published_at: null });
    assert.deepEqual(versionBadge(draft, [v(5)]), { state: "draft", label: "Süren taslak", inProgress: true });
  });

  // An operator's newer save covers the older one: it stays in the history, restorable.
  it("is a draft its author has since saved over", () => {
    const draft = summary(4, { published_at: null });
    assert.deepEqual(versionBadge(draft, [v(5)]), { state: "draft", label: "Taslak", inProgress: false });
  });

  it("is a draft its author gave up", () => {
    const discarded = summary(4, { published_at: null, discarded: true });
    assert.deepEqual(versionBadge(discarded, [v(4)]), { state: "discarded", label: "Atılmış taslak", inProgress: false });
  });
});

describe("when a version was written", () => {
  // The browser runs wherever it runs; the club's time is Istanbul's (UTC+3).
  it("says when a draft was written, in Istanbul", () => {
    assert.equal(versionWhen(summary(5, { created_at: "2026-09-23T07:12:00Z", published_at: null })), "yazıldı 23 Eyl 2026 10:12");
  });

  it("says once when a version was published as it was written", () => {
    assert.equal(versionWhen(summary(2)), "yayımlandı 22 Eyl 2026 10:12");
  });

  it("says both when a draft was published later", () => {
    const published = summary(4, { created_at: "2026-09-22T21:10:00Z", published_at: "2026-09-23T06:00:00Z" });
    assert.equal(versionWhen(published), "yazıldı 23 Eyl 2026 00:10 · yayımlandı 23 Eyl 2026 09:00");
  });
});

describe("what a version names the template and asks as its subject", () => {
  it("names the template only where it differs from what the template is called now", () => {
    assert.equal(versionName(summary(2, { name: "Eski ad" }), "Hoş geldin"), "Eski ad");
    assert.equal(versionName(summary(2), "Hoş geldin"), null);
    assert.equal(versionName(summary(2, { name: undefined }), "Hoş geldin"), null);
  });

  // A seed version from before the seed's conflict rule kept an operator's subject over the repo's.
  it("says what subject a Template seed asked for where it kept another", () => {
    const seeded = summary(2, {
      author: { kind: "template_seed", sub: "svc-1", name: null },
      subject: "Operatörün konusu",
      requested_subject: "Repodaki konu",
    });
    assert.equal(requestedSubject(seeded), "Repodaki konu");
    assert.equal(requestedSubject({ ...seeded, requested_subject: "Operatörün konusu" }), null);
    assert.equal(requestedSubject(summary(2)), null);
  });
});

describe("which two versions a comparison shows", () => {
  const listed = [summary(5, { published_at: null }), summary(4, { current: true }), summary(3), summary(2), summary(1)];

  it("puts a version beside the one being sent", () => {
    assert.deepEqual(defaultComparison(listed[3], v(4), listed), { versionId: v(2), againstId: v(4) });
    assert.deepEqual(defaultComparison(listed[0], v(4), listed), { versionId: v(5), againstId: v(4) });
  });

  // The sent one beside itself shows nothing: beside what it started from, it shows what it changed.
  it("puts the version being sent beside the one it started from", () => {
    assert.deepEqual(defaultComparison(listed[1], v(4), listed), { versionId: v(4), againstId: v(3) });
  });

  it("falls back to the next older version listed when the sent one started from none", () => {
    const first = summary(2, { current: true, base_version_id: null });
    assert.deepEqual(defaultComparison(first, v(2), [first, summary(1)]), { versionId: v(2), againstId: v(1) });
  });

  it("offers none for a template's only version", () => {
    const only = summary(1, { current: true });
    assert.equal(defaultComparison(only, v(1), [only]), null);
  });

  it("orders the two by when they were written, older first", () => {
    const [older, newer] = inSeqOrder(version(7), version(3));
    assert.equal(older.seq, 3);
    assert.equal(newer.seq, 7);
  });
});

describe("picking two versions to compare", () => {
  it("adds a version, and takes it out again", () => {
    assert.deepEqual(togglePick([], v(1)), [v(1)]);
    assert.deepEqual(togglePick([v(1), v(3)], v(1)), [v(3)]);
  });

  it("keeps the two picked last", () => {
    assert.deepEqual(togglePick([v(1), v(3)], v(5)), [v(3), v(5)]);
  });
});

describe("what a comparison says in words", () => {
  it("says the name, the subject, the Main source and the body are the same where they are", () => {
    const facts = comparisonFacts(version(2), version(3));
    assert.deepEqual(
      facts.map(({ label, same }) => [label, same]),
      [
        ["Ad", true],
        ["Konu", true],
        ["Main source", true],
        ["Gövde", true],
      ],
    );
  });

  it("names both sides of what differs", () => {
    const older = version(2, { name: "Hoş geldin", subject: "Merhaba {{.FirstName}}", main_mode: "html" });
    const newer = version(5, { name: "Hoş geldin maili", subject: "SKY LAB'e hoş geldin", main_mode: "jsx" });
    assert.deepEqual(comparisonFacts(older, newer).slice(0, 3), [
      { label: "Ad", older: "Hoş geldin", newer: "Hoş geldin maili", same: false },
      { label: "Konu", older: "Merhaba {{.FirstName}}", newer: "SKY LAB'e hoş geldin", same: false },
      { label: "Main source", older: "HTML", newer: "JSX", same: false },
    ]);
  });

  // The body is shown as rendered mail beside this; the words only say whether it changed.
  it("says whether the sent body differs, the plain text included, without quoting it", () => {
    const body = (facts: ReturnType<typeof comparisonFacts>) => facts.find((fact) => fact.label === "Gövde");
    assert.deepEqual(body(comparisonFacts(version(2), version(3, { html_content: "<p>Selam</p>" }))), {
      label: "Gövde",
      older: null,
      newer: null,
      same: false,
    });
    assert.equal(body(comparisonFacts(version(2), version(3, { plain_text_content: "Selam" })))?.same, false);
  });

  it("does not claim a name a backend did not send", () => {
    const [name] = comparisonFacts(version(2, { name: undefined }), version(3));
    assert.deepEqual(name, { label: "Ad", older: null, newer: "Hoş geldin", same: false });
  });
});

describe("the sample values a comparison fills both mails with", () => {
  it("are for every variable either body references, each once", () => {
    assert.deepEqual(comparedVariables("<p>{{.FirstName}} {{.Link}}</p>", "<p>{{.FirstName}}</p>{{if .EventUrl}}x{{end}}"), [
      "FirstName",
      "Link",
      "EventUrl",
    ]);
  });
});

describe("restoring a version", () => {
  it("posts to the version's restore, with no body", async () => {
    const { api, calls } = scriptedClient(json(201, version(6, { published_at: null })));

    await restoreVersion(api, TEMPLATE, v(2));

    assert.equal(pathOf(calls[0]), `/templates/${TEMPLATE}/versions/${v(2)}/restore`);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].body, null);
  });

  it("opens a new draft, and says live mail did not change", () => {
    const outcome = restoreOutcome(version(6, { published_at: null }), { seq: 2 }, v(5));
    assert.equal(outcome.kind, "drafted");
    assert.equal(outcome.openEditor, true);
    assert.equal(
      outcome.text,
      "Sürüm #2 yeni bir taslak olarak geri getirildi (#6). Canlı mail değişmedi; yayımlayana kadar gönderilen sürüm aynı kalır.",
    );
  });

  it("opens the viewer's draft when it already is that version", () => {
    const outcome = restoreOutcome(version(5, { published_at: null }), { seq: 2 }, v(5));
    assert.equal(outcome.kind, "already-draft");
    assert.equal(outcome.openEditor, true);
    assert.match(outcome.text, /^Süren taslağın zaten sürüm #2 ile aynı; yeni taslak açılmadı\./);
  });

  it("opens nothing when that version is what is sent already", () => {
    const outcome = restoreOutcome(version(4, { published_at: "2026-09-22T07:12:00Z", current: true }), { seq: 2 }, null);
    assert.equal(outcome.kind, "already-sent");
    assert.equal(outcome.openEditor, false);
    assert.equal(outcome.text, "Sürüm #2, şu an gönderilen sürümle aynı; yeni taslak açılmadı.");
  });
});
