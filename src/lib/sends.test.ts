/**
 * What the home screen, the send list and a send make of skymail-backend's
 * answers (`GET /mail_tasks/summary`, `GET /mail_tasks?status=`,
 * `GET /mail_tasks/:id` and its `/queue?status=`). The numbers on the home
 * screen count different things — mails to one recipient, sends — so these
 * tests pin which field each one reads and the unit it is shown with.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./api/errors";
import { TEST_BASE_URL, json, scriptedClient } from "./api/testing";
import {
  audienceLabel,
  composeHref,
  dailySeries,
  dayLabel,
  fetchRecipientPage,
  fetchSend,
  fetchSendPage,
  formatSendTime,
  homeTiles,
  noRecipientsNote,
  readRecipientView,
  readSendListView,
  RECIPIENT_PAGE_SIZE,
  recipientFilters,
  recipientsLabel,
  recipientStatus,
  recipientSummary,
  SEND_PAGE_SIZE,
  sendHref,
  sendListHref,
  STATUS_FILTERS,
  templateLabel,
  type SendAudience,
  type SendSummary,
} from "./sends";

const SEND_ID = "e69521e9-b026-47a1-a96e-cce12f5b7bfd";

function summary(overrides: Partial<SendSummary> = {}): SendSummary {
  return {
    time_zone: "Europe/Istanbul",
    queue_counts: { pending: 2, processing: 1, sent: 1532, failed: 7 },
    send_counts: { failed: 3, sending: 1, sent: 140 },
    daily_sent: [
      { date: "2026-09-21", sent: 40 },
      { date: "2026-09-22", sent: 0 },
      { date: "2026-09-23", sent: 12 },
    ],
    recent_sends: [],
    ...overrides,
  };
}

const params = (search: string) => new URLSearchParams(search);

describe("the home screen's tiles", () => {
  const byKey = (s: SendSummary) => Object.fromEntries(homeTiles(s).map((tile) => [tile.key, tile]));

  it("count pending mails as the queue's pending and processing rows", () => {
    const tile = byKey(summary()).pending;
    assert.equal(tile.value, 3);
    assert.equal(tile.unit, "mail");
  });

  it("count mails sent today as the last day of the daily series", () => {
    const tile = byKey(summary()).sentToday;
    assert.equal(tile.value, 12);
    assert.equal(tile.unit, "mail");
  });

  it("show 0 sent today when the series is empty", () => {
    assert.equal(byKey(summary({ daily_sent: [] })).sentToday.value, 0);
  });

  // send_counts.failed equals X-Total-Count of ?status=failed by contract;
  // queue_counts.failed counts failed mails, a different number.
  it("count failed sends, not failed mails, and open the failed send list", () => {
    const tile = byKey(summary()).failed;
    assert.equal(tile.value, 3);
    assert.equal(tile.unit, "gönderim");
    assert.equal(tile.href, "/mail-tasks?status=failed");
  });

  it("come in a fixed order, each labelled for what it counts, and only the failed one links", () => {
    assert.deepEqual(
      homeTiles(summary()).map((tile) => [tile.key, tile.label, tile.note, tile.href]),
      [
        ["pending", "Bekleyen mail", "Kuyrukta gönderilmeyi bekleyen, alıcı başına bir mail", null],
        ["sentToday", "Bugün gönderilen", "İstanbul saatiyle bugün alıcılara giden mail", null],
        ["failed", "Başarısız gönderim", "En az bir alıcısına ulaşamayan gönderim", "/mail-tasks?status=failed"],
      ],
    );
  });

  // The API says which zone its days are in; "today" is that zone's today.
  it("say which zone's today they count in, as the API names it", () => {
    assert.equal(byKey(summary({ time_zone: "UTC" })).sentToday.note, "UTC saatiyle bugün alıcılara giden mail");
  });
});

describe("the daily chart", () => {
  it("keeps every day of the series in order, labelled as the API dated it", () => {
    assert.deepEqual(dailySeries(summary().daily_sent), [
      { date: "2026-09-21", label: "21 Eyl", sent: 40 },
      { date: "2026-09-22", label: "22 Eyl", sent: 0 },
      { date: "2026-09-23", label: "23 Eyl", sent: 12 },
    ]);
  });

  it("shows an unreadable date as it came", () => {
    assert.equal(dayLabel("dün"), "dün");
  });
});

describe("the send list's address", () => {
  it("offers Hepsi · Gönderiliyor · Gönderildi · Başarısız", () => {
    assert.deepEqual(
      STATUS_FILTERS.map((filter) => [filter.value, filter.label]),
      [
        ["all", "Hepsi"],
        ["sending", "Gönderiliyor"],
        ["sent", "Gönderildi"],
        ["failed", "Başarısız"],
      ],
    );
  });

  it("reads the status, whatever its case, and the page", () => {
    assert.deepEqual(readSendListView(params("status=failed&page=3")), { status: "failed", page: 3 });
    assert.deepEqual(readSendListView(params("status=Sending")), { status: "sending", page: 1 });
    assert.deepEqual(readSendListView(params("status=%20sent%20")), { status: "sent", page: 1 });
  });

  // The API answers 400 to any other status; the list shows everything instead.
  it("falls back to every send on the first page for anything else", () => {
    for (const search of ["", "status=pending", "status=empty", "status=constructor", "status=all"]) {
      assert.equal(readSendListView(params(search)).status, "all", search);
    }
    for (const page of ["0", "-2", "2.5", "abc", ""]) {
      assert.equal(readSendListView(params(`page=${page}`)).page, 1, page);
    }
  });

  it("writes the status and page, leaving out the defaults", () => {
    assert.equal(sendListHref({ status: "all" }), "/mail-tasks");
    assert.equal(sendListHref({ status: "failed" }), "/mail-tasks?status=failed");
    assert.equal(sendListHref({ status: "failed", page: 1 }), "/mail-tasks?status=failed");
    assert.equal(sendListHref({ status: "sent", page: 3 }), "/mail-tasks?status=sent&page=3");
    assert.equal(sendListHref({ status: "all", page: 2 }), "/mail-tasks?page=2");
  });

  it("round-trips every filter", () => {
    for (const filter of STATUS_FILTERS) {
      const search = new URL(sendListHref({ status: filter.value, page: 2 }), "http://x").searchParams;
      assert.deepEqual(readSendListView(search), { status: filter.value, page: 2 });
    }
  });
});

describe("the send form's address", () => {
  // superadmin links an Event's list to /mail-tasks/create?mail_list_id=<id>; so do the panel's own buttons.
  it("is /mail-tasks/create, with the list to preselect", () => {
    assert.equal(composeHref(), "/mail-tasks/create");
    assert.equal(composeHref(SEND_ID), `/mail-tasks/create?mail_list_id=${SEND_ID}`);
    assert.equal(composeHref("a b&c"), "/mail-tasks/create?mail_list_id=a+b%26c");
  });
});

describe("a page of sends", () => {
  it("asks for the chosen status and the page's slice, and keeps the total", async () => {
    const { api, calls } = scriptedClient(json(200, [], { "X-Total-Count": "31" }));

    const page = await fetchSendPage(api, { status: "failed", page: 2 });

    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks?status=failed&_start=${SEND_PAGE_SIZE}&_end=${2 * SEND_PAGE_SIZE}`);
    assert.deepEqual(page, { items: [], total: 31 });
  });

  it("sends no status for Hepsi", async () => {
    const { api, calls } = scriptedClient(json(200, []));

    await fetchSendPage(api, { status: "all", page: 1 });

    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks?_start=0&_end=${SEND_PAGE_SIZE}`);
  });
});

describe("a send's address", () => {
  it("is /mail-tasks/show/<id>, with the recipient filter and page when they are not the defaults", () => {
    assert.equal(sendHref(SEND_ID), `/mail-tasks/show/${SEND_ID}`);
    assert.equal(sendHref(SEND_ID, { status: "all", page: 1 }), `/mail-tasks/show/${SEND_ID}`);
    assert.equal(sendHref(SEND_ID, { status: "failed" }), `/mail-tasks/show/${SEND_ID}?status=failed`);
    assert.equal(sendHref(SEND_ID, { status: "sent", page: 2 }), `/mail-tasks/show/${SEND_ID}?status=sent&page=2`);
  });

  // Recipient statuses are queue statuses, not the send's derived one.
  it("reads a recipient status from the address, and nothing else", () => {
    assert.deepEqual(readRecipientView(params("status=FAILED&page=2")), { status: "failed", page: 2 });
    assert.deepEqual(readRecipientView(params("status=pending")), { status: "pending", page: 1 });
    assert.deepEqual(readRecipientView(params("status=processing")), { status: "processing", page: 1 });
    assert.deepEqual(readRecipientView(params("status=sending")), { status: "all", page: 1 });
    assert.deepEqual(readRecipientView(params("page=x")), { status: "all", page: 1 });
  });

  it("round-trips through the address", () => {
    for (const status of ["all", "pending", "processing", "sent", "failed"] as const) {
      const search = new URL(sendHref(SEND_ID, { status, page: 3 }), "http://x").searchParams;
      assert.deepEqual(readRecipientView(search), { status, page: 3 });
    }
  });
});

describe("the recipient filter", () => {
  const counts = { pending: 0, processing: 0, sent: 26, failed: 1 };

  it("offers Hepsi and the statuses the send's recipients are in, failed first, each with its count", () => {
    assert.deepEqual(recipientFilters(counts, "all"), [
      { value: "all", label: "Hepsi (27)" },
      { value: "failed", label: "Başarısız (1)" },
      { value: "sent", label: "Gönderildi (26)" },
    ]);
  });

  it("keeps the chosen status even when no recipient is in it", () => {
    assert.deepEqual(
      recipientFilters(counts, "pending").map((filter) => filter.value),
      ["all", "failed", "pending", "sent"],
    );
  });
});

describe("a send and its recipients", () => {
  it("reads the send by id", async () => {
    const { api, calls } = scriptedClient(json(200, { id: SEND_ID }));

    assert.deepEqual(await fetchSend(api, SEND_ID), { id: SEND_ID });
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks/${SEND_ID}`);
  });

  // The API answers a malformed id with 500, not 404.
  it("reports an id that is not a UUID as a missing send, without a request", async () => {
    const { api, calls } = scriptedClient();

    const error = await fetchSend(api, "not-a-send").catch((reason: unknown) => reason);

    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 404);
    assert.equal(calls.length, 0);
  });

  it("asks the queue for the chosen recipient status and the page's slice", async () => {
    const { api, calls } = scriptedClient(json(200, null, { "X-Total-Count": "0" }), json(200, []));

    assert.deepEqual(await fetchRecipientPage(api, SEND_ID, { status: "failed", page: 2 }), { items: [], total: 0 });
    await fetchRecipientPage(api, SEND_ID, { status: "all", page: 1 });

    assert.equal(
      calls[0].url,
      `${TEST_BASE_URL}/mail_tasks/${SEND_ID}/queue?status=failed&_start=${RECIPIENT_PAGE_SIZE}&_end=${2 * RECIPIENT_PAGE_SIZE}`,
    );
    assert.equal(calls[1].url, `${TEST_BASE_URL}/mail_tasks/${SEND_ID}/queue?_start=0&_end=${RECIPIENT_PAGE_SIZE}`);
  });
});

describe("the audience of a send", () => {
  const audience = (overrides: Partial<SendAudience>): SendAudience => ({
    kind: "mailing_list",
    mail_list_id: null,
    name: null,
    source: null,
    recipient_full_name: null,
    recipient_email: null,
    ...overrides,
  });

  it("names an internal mailing list", () => {
    assert.deepEqual(audienceLabel(audience({ mail_list_id: "list-1", name: "WebLab", source: "internal" })), {
      kind: "list",
      name: "WebLab",
      detail: null,
      listId: "list-1",
    });
  });

  it("names a Keycloak group by the name the API resolved, as a group", () => {
    assert.deepEqual(audienceLabel(audience({ mail_list_id: "group-1", name: "Gecekodu", source: "keycloak" })), {
      kind: "group",
      name: "Gecekodu",
      detail: null,
      listId: "group-1",
    });
  });

  // Keycloak did not answer in time, or the group is gone.
  it("falls back to a label only for a Keycloak group with no name", () => {
    const label = audienceLabel(audience({ mail_list_id: "group-2", name: null, source: "keycloak" }));
    assert.equal(label.kind, "group");
    assert.equal(label.name, "Keycloak grubu");
  });

  it("names the one recipient of a single send, with the address underneath", () => {
    assert.deepEqual(
      audienceLabel(
        audience({ kind: "single", recipient_full_name: "Ayşe Yılmaz", recipient_email: "ayse@example.com" }),
      ),
      { kind: "person", name: "Ayşe Yılmaz", detail: "ayse@example.com", listId: null },
    );
  });

  it("shows the address alone when the single recipient has no name", () => {
    assert.deepEqual(
      audienceLabel(audience({ kind: "single", recipient_full_name: "", recipient_email: "ayse@example.com" })),
      { kind: "person", name: "ayse@example.com", detail: null, listId: null },
    );
  });

  // Only a Mail onayı request goes to several people; it names them itself (approvalAudience).
  it("is people, not a list, for an audience of several", () => {
    assert.deepEqual(audienceLabel(audience({ kind: "people" })), { kind: "people", name: "Kişiler", detail: null, listId: null });
  });
});

describe("a send's Mail template", () => {
  it("is shown by name, with a label when the send has none", () => {
    assert.equal(templateLabel({ template_name: "Bülten" }), "Bülten");
    assert.equal(templateLabel({ template_name: null }), "Mail template yok");
    assert.equal(templateLabel({ template_name: "  " }), "Mail template yok");
  });
});

describe("a send's recipients", () => {
  it("are labelled by their number", () => {
    assert.equal(recipientsLabel(0), "Alıcı yok");
    assert.equal(recipientsLabel(1), "1 alıcı");
    assert.equal(recipientsLabel(1532), "1.532 alıcı");
  });

  it("are totalled, with only the statuses that occur", () => {
    assert.deepEqual(recipientSummary({ pending: 0, processing: 0, sent: 3, failed: 1 }), {
      total: 4,
      parts: ["3 gönderildi", "1 başarısız"],
    });
    assert.deepEqual(recipientSummary({ pending: 2, processing: 1, sent: 0, failed: 0 }), {
      total: 3,
      parts: ["3 bekliyor"],
    });
    assert.deepEqual(recipientSummary({ pending: 0, processing: 0, sent: 0, failed: 0 }), { total: 0, parts: [] });
  });

  // skymail-backend encodes a queue row's status as sqlc's NullMailQueueStatus.
  it("each have the status in status.mail_queue_status", () => {
    assert.equal(recipientStatus({ mail_queue_status: "failed", valid: true }), "failed");
    assert.equal(recipientStatus({ mail_queue_status: "processing", valid: true }), "processing");
    assert.equal(recipientStatus({ mail_queue_status: "sent", valid: true }), "sent");
  });

  it("count a row with no status as pending, as the queue's default is", () => {
    assert.equal(recipientStatus({ mail_queue_status: "", valid: false }), "pending");
    assert.equal(recipientStatus(null), "pending");
    assert.equal(recipientStatus({ mail_queue_status: "bounced", valid: true }), "pending");
  });

  // mail_task_status: no queue rows is sending for a minute, then failed.
  it("explain a send that queued no one", () => {
    const created = "2026-09-23T06:00:00Z";
    assert.match(noRecipientsNote(created, new Date("2026-09-23T06:00:30Z")), /kuyruğa yazılıyor/);
    assert.match(noRecipientsNote(created, new Date("2026-09-23T06:05:00Z")), /kimse kuyruğa alınmadı/);
  });
});

describe("a send's time", () => {
  // 21:10 UTC is ten past midnight the next day in Istanbul.
  it("is shown in Europe/Istanbul unless a zone is given", () => {
    assert.equal(formatSendTime("2026-09-22T21:10:00Z"), "23 Eyl 2026 00:10");
    assert.equal(formatSendTime("2026-09-22T21:10:00Z", "UTC"), "22 Eyl 2026 21:10");
  });

  it("falls back to Europe/Istanbul for a zone it does not know", () => {
    assert.equal(formatSendTime("2026-09-22T21:10:00Z", "Mars/Olympus"), "23 Eyl 2026 00:10");
  });

  it("is a dash when missing or unreadable", () => {
    assert.equal(formatSendTime(null), "—");
    assert.equal(formatSendTime("not a date"), "—");
  });
});
