/**
 * What the home screen and the send list make of skymail-backend's answers
 * (`GET /mail_tasks/summary`, `GET /mail_tasks?status=`, the send and its
 * queue). The numbers on the home screen count different things — mails to
 * one recipient, sends — so these tests pin which field each one reads and
 * the unit it is shown with.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  audienceOfRecentSend,
  audienceOfSendRow,
  countRecipients,
  dailySeries,
  dayLabel,
  followUpOrder,
  formatSendTime,
  homeTiles,
  noRecipientsNote,
  pageCount,
  pageFromSearch,
  recipientStatus,
  recipientSummary,
  sendListHref,
  sendListQuery,
  STATUS_FILTERS,
  statusFromSearch,
  templateLabel,
  type RecipientRow,
  type SendSummary,
} from "./sends";

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

  it("come in a fixed order, each with its own label", () => {
    const tiles = homeTiles(summary());
    assert.deepEqual(
      tiles.map((tile) => tile.key),
      ["pending", "sentToday", "failed"],
    );
    assert.equal(new Set(tiles.map((tile) => tile.label)).size, 3);
    assert.equal(tiles[0].href, null);
    assert.equal(tiles[1].href, null);
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

  // The date is already an Istanbul calendar day; converting it through a
  // time zone would move midnight-UTC dates to the previous day west of UTC.
  it("labels a date without moving it through a time zone", () => {
    assert.equal(dayLabel("2026-01-01"), "1 Oca");
    assert.equal(dayLabel("2026-12-31"), "31 Ara");
  });

  it("shows an unreadable date as it came", () => {
    assert.equal(dayLabel("dün"), "dün");
  });
});

describe("the status filter", () => {
  it("offers Hepsi · Gönderiliyor · Gönderildi · Başarısız", () => {
    assert.deepEqual(
      STATUS_FILTERS.map((filter) => [filter.value, filter.label]),
      [
        [null, "Hepsi"],
        ["sending", "Gönderiliyor"],
        ["sent", "Gönderildi"],
        ["failed", "Başarısız"],
      ],
    );
  });

  it("reads a status from the address, whatever its case", () => {
    assert.equal(statusFromSearch("failed"), "failed");
    assert.equal(statusFromSearch("Sending"), "sending");
    assert.equal(statusFromSearch(" sent "), "sent");
  });

  // The API answers 400 to any other value; the list shows everything instead.
  it("treats a missing or unknown status as Hepsi", () => {
    assert.equal(statusFromSearch(null), null);
    assert.equal(statusFromSearch(""), null);
    assert.equal(statusFromSearch("pending"), null);
    assert.equal(statusFromSearch("empty"), null);
    assert.equal(statusFromSearch("constructor"), null);
  });

  it("writes the status and page into the address, leaving out the defaults", () => {
    assert.equal(sendListHref({ status: null }), "/mail-tasks");
    assert.equal(sendListHref({ status: "failed" }), "/mail-tasks?status=failed");
    assert.equal(sendListHref({ status: "failed", page: 1 }), "/mail-tasks?status=failed");
    assert.equal(sendListHref({ status: "sent", page: 3 }), "/mail-tasks?status=sent&page=3");
    assert.equal(sendListHref({ status: null, page: 2 }), "/mail-tasks?page=2");
  });

  it("round-trips through the address", () => {
    for (const filter of STATUS_FILTERS) {
      const search = new URL(sendListHref({ status: filter.value }), "http://x").searchParams;
      assert.equal(statusFromSearch(search.get("status")), filter.value);
    }
  });

  it("asks the API for the page's range, with the status only when one is chosen", () => {
    assert.deepEqual(sendListQuery({ status: "failed", page: 1, pageSize: 20 }), {
      status: "failed",
      _start: 0,
      _end: 20,
    });
    assert.deepEqual(sendListQuery({ status: null, page: 3, pageSize: 20 }), { _start: 40, _end: 60 });
  });
});

describe("paging", () => {
  it("reads the page from the address, falling back to the first", () => {
    assert.equal(pageFromSearch("3"), 3);
    assert.equal(pageFromSearch(null), 1);
    assert.equal(pageFromSearch("0"), 1);
    assert.equal(pageFromSearch("-2"), 1);
    assert.equal(pageFromSearch("2.5"), 1);
    assert.equal(pageFromSearch("abc"), 1);
  });

  it("counts the pages of a total, never fewer than one", () => {
    assert.equal(pageCount(0, 20), 1);
    assert.equal(pageCount(20, 20), 1);
    assert.equal(pageCount(21, 20), 2);
  });
});

describe("the audience of a send", () => {
  it("names an internal mailing list", () => {
    assert.deepEqual(
      audienceOfRecentSend({
        kind: "mailing_list",
        mail_list_id: "list-1",
        name: "WebLab",
        source: "internal",
        recipient_full_name: null,
        recipient_email: null,
      }),
      { kind: "list", name: "WebLab", detail: null, listId: "list-1" },
    );
  });

  it("names a Keycloak group by its name, as a group", () => {
    assert.deepEqual(
      audienceOfRecentSend({
        kind: "mailing_list",
        mail_list_id: "group-1",
        name: "Gecekodu",
        source: "keycloak",
        recipient_full_name: null,
        recipient_email: null,
      }),
      { kind: "group", name: "Gecekodu", detail: null, listId: "group-1" },
    );
  });

  // Keycloak did not answer in time, or the group is gone.
  it("falls back to a label for a Keycloak group with no name", () => {
    const audience = audienceOfRecentSend({
      kind: "mailing_list",
      mail_list_id: "group-2",
      name: null,
      source: "keycloak",
      recipient_full_name: null,
      recipient_email: null,
    });
    assert.equal(audience.kind, "group");
    assert.equal(audience.name, "Keycloak grubu");
  });

  it("names the one recipient of a single send, with the address underneath", () => {
    assert.deepEqual(
      audienceOfRecentSend({
        kind: "single",
        mail_list_id: null,
        name: null,
        source: null,
        recipient_full_name: "Ayşe Yılmaz",
        recipient_email: "ayse@example.com",
      }),
      { kind: "person", name: "Ayşe Yılmaz", detail: "ayse@example.com", listId: null },
    );
  });

  it("shows the address alone when the single recipient has no name", () => {
    assert.deepEqual(
      audienceOfRecentSend({
        kind: "single",
        mail_list_id: null,
        name: null,
        source: null,
        recipient_full_name: "",
        recipient_email: "ayse@example.com",
      }),
      { kind: "person", name: "ayse@example.com", detail: null, listId: null },
    );
  });

  // The send list carries no Keycloak names and no single recipient.
  it("reads a send list row: list by name, unnamed list as a Keycloak group, no list as one person", () => {
    assert.deepEqual(audienceOfSendRow({ mail_list_id: "list-1", mail_list_name: "WebLab" }), {
      kind: "list",
      name: "WebLab",
      detail: null,
      listId: "list-1",
    });
    assert.deepEqual(audienceOfSendRow({ mail_list_id: "group-1", mail_list_name: null }), {
      kind: "group",
      name: "Keycloak grubu",
      detail: null,
      listId: "group-1",
    });
    assert.deepEqual(audienceOfSendRow({ mail_list_id: null, mail_list_name: null }), {
      kind: "person",
      name: "Tek kişi",
      detail: null,
      listId: null,
    });
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
  it("are totalled, with only the statuses that occur", () => {
    assert.deepEqual(recipientSummary({ pending: 0, processing: 0, sent: 3, failed: 1 }), {
      total: 4,
      parts: ["3 gönderildi", "1 başarısız"],
    });
    assert.deepEqual(recipientSummary({ pending: 2, processing: 1, sent: 0, failed: 0 }), {
      total: 3,
      parts: ["3 bekliyor"],
    });
    assert.deepEqual(recipientSummary({ pending: 0, processing: 0, sent: 0, failed: 0 }), {
      total: 0,
      parts: [],
    });
  });

  // skymail-backend encodes a queue row's status as sqlc's NullMailQueueStatus.
  it("each have the status the queue row carries", () => {
    assert.equal(recipientStatus({ mail_queue_status: "failed", valid: true }), "failed");
    assert.equal(recipientStatus({ mail_queue_status: "processing", valid: true }), "processing");
    assert.equal(recipientStatus("sent"), "sent");
  });

  it("count a row with no status as pending, as the queue's default is", () => {
    assert.equal(recipientStatus({ mail_queue_status: "", valid: false }), "pending");
    assert.equal(recipientStatus(null), "pending");
    assert.equal(recipientStatus({ mail_queue_status: "bounced", valid: true }), "pending");
  });

  function row(id: string, status: string): RecipientRow {
    return {
      id,
      recipient_full_name: "",
      recipient_email: `${id}@example.com`,
      status: { mail_queue_status: status, valid: true },
      error: null,
      attempts: 1,
      next_attempt_at: null,
      created_at: null,
    };
  }

  it("are counted by status from their queue rows", () => {
    assert.deepEqual(countRecipients([row("a", "sent"), row("b", "failed"), row("c", "sent"), row("d", "pending")]), {
      pending: 1,
      processing: 0,
      sent: 2,
      failed: 1,
    });
  });

  // The detail exists to follow up on failures; the API lists a send's
  // recipients newest first, whatever their status.
  it("are ordered failed first, then those still going out, then sent, keeping the API's order within each", () => {
    const ordered = followUpOrder([
      row("s1", "sent"),
      row("p1", "pending"),
      row("f1", "failed"),
      row("s2", "sent"),
      row("r1", "processing"),
      row("f2", "failed"),
    ]);
    assert.deepEqual(
      ordered.map((r) => r.id),
      ["f1", "f2", "r1", "p1", "s1", "s2"],
    );
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
  it("is shown in Europe/Istanbul", () => {
    assert.equal(formatSendTime("2026-09-22T21:10:00Z"), "23 Eyl 2026 00:10");
  });

  it("is a dash when missing or unreadable", () => {
    assert.equal(formatSendTime(null), "—");
    assert.equal(formatSendTime("not a date"), "—");
  });
});
