/**
 * Mail onayı as the screens show it (ticket 20): where a request lives (the
 * approval mails link to `/mail-approvals/show/:id`, `#preview` for the
 * preview), which requests the list asks for, and how long one has left.
 * Times are the club's, Europe/Istanbul, on every screen. A request goes to
 * a list or to people, each with a send of their own once approved (ticket
 * 22); an API from before that (ticket 19) named one person in the audience.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEST_BASE_URL, json, scriptedClient } from "../api/testing";
import {
  APPROVAL_FILTERS,
  APPROVAL_PAGE_SIZE,
  APPROVAL_STATE_LABEL,
  approvalAudience,
  approvalHref,
  approvalListHref,
  approvalPeople,
  approvalPreviewHref,
  approvalSends,
  copyApprovalHref,
  deadlineHint,
  effectiveState,
  eventActorName,
  eventLabel,
  fetchApprovalPage,
  notificationNote,
  pendingCount,
  previewNote,
  previewRecipient,
  readApprovalListView,
  resubmitHref,
  submitterName,
  type ApprovalEvent,
  type ApprovalItem,
  type ApprovalState,
  type MailApproval,
} from "./approvals";

const ID = "5d1e7c2a-0000-4000-8000-000000000001";
const NOW = new Date("2026-09-23T09:00:00Z");
const after = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe("where a request lives", () => {
  it("is the address the approval mails link to, with #preview for its preview", () => {
    assert.equal(approvalHref(ID), `/mail-approvals/show/${ID}`);
    assert.equal(approvalPreviewHref(ID), `/mail-approvals/show/${ID}#preview`);
    assert.equal(resubmitHref(ID), `/mail-approvals/edit/${ID}`);
    assert.equal(copyApprovalHref(ID), `/mail-tasks/create?from_approval=${ID}`);
  });
});

describe("the list's view", () => {
  // An approver's work is what waits for them; anyone else follows their own.
  it("starts on everyone's pending ones for an approver, and on all of their own for anyone else", () => {
    assert.deepEqual(readApprovalListView(new URLSearchParams(""), { approver: true }), { state: "pending", mine: false, page: 1 });
    assert.deepEqual(readApprovalListView(new URLSearchParams(""), { approver: false }), { state: "all", mine: true, page: 1 });
  });

  it("reads a state, whose requests and a page from the address, and falls back on anything else", () => {
    assert.deepEqual(readApprovalListView(new URLSearchParams("state=expired&page=3"), { approver: true }), { state: "expired", mine: false, page: 3 });
    assert.deepEqual(readApprovalListView(new URLSearchParams("state=declined&mine=true"), { approver: true }), { state: "declined", mine: true, page: 1 });
    assert.deepEqual(readApprovalListView(new URLSearchParams("state=nope&page=-1&mine=no"), { approver: false }), { state: "all", mine: true, page: 1 });
  });

  it("leaves the viewer's default out of the address", () => {
    assert.equal(approvalListHref({ state: "pending", mine: false, page: 1 }, { approver: true }), "/mail-approvals");
    assert.equal(approvalListHref({ state: "all", mine: false, page: 1 }, { approver: true }), "/mail-approvals?state=all");
    assert.equal(approvalListHref({ state: "pending", mine: true, page: 1 }, { approver: true }), "/mail-approvals?mine=true");
    assert.equal(approvalListHref({ state: "all", mine: true, page: 2 }, { approver: false }), "/mail-approvals?page=2");
    assert.equal(approvalListHref({ state: "returned", mine: true, page: 1 }, { approver: false }), "/mail-approvals?state=returned");
  });

  it("offers Bekleyen · Geri dönen · Onaylanan · Reddedilen · Kabul edilmedi · Süresi dolan · Hepsi, in that order", () => {
    assert.deepEqual(
      APPROVAL_FILTERS.map((filter) => [filter.value, filter.label]),
      [
        ["pending", "Bekleyen"],
        ["returned", "Geri dönen"],
        ["approved", "Onaylanan"],
        ["rejected", "Reddedilen"],
        ["declined", "Kabul edilmedi"],
        ["expired", "Süresi dolan"],
        ["all", "Hepsi"],
      ],
    );
  });

  it("asks for everyone's requests or an approver's own, and the viewer's own for anyone else, a page at a time", async () => {
    const { api, calls } = scriptedClient(json(200, [], { "X-Total-Count": "30" }), json(200, null), json(200, null));
    const page = await fetchApprovalPage(api, { state: "pending", mine: false, page: 2 }, { approver: true });
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_approvals?state=pending&_start=${APPROVAL_PAGE_SIZE}&_end=${2 * APPROVAL_PAGE_SIZE}`);
    assert.deepEqual(page, { items: [], total: 30 });

    await fetchApprovalPage(api, { state: "declined", mine: true, page: 1 }, { approver: true });
    assert.equal(calls[1].url, `${TEST_BASE_URL}/mail_approvals?state=declined&mine=true&_start=0&_end=${APPROVAL_PAGE_SIZE}`);

    await fetchApprovalPage(api, { state: "all", mine: true, page: 1 }, { approver: false });
    assert.equal(calls[2].url, `${TEST_BASE_URL}/mail_approvals?mine=true&_start=0&_end=${APPROVAL_PAGE_SIZE}`);
  });

  it("counts what waits for an approver from the list's total", async () => {
    const { api, calls } = scriptedClient(json(200, [{ id: ID }], { "X-Total-Count": "4" }));
    assert.equal(await pendingCount(api), 4);
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_approvals?state=pending&_start=0&_end=1`);
  });
});

describe("how long a request has left", () => {
  it("counts whole days while there is a day or more", () => {
    assert.deepEqual(deadlineHint(after(7 * DAY), NOW), { text: "7 gün kaldı", urgent: false, passed: false });
    assert.deepEqual(deadlineHint(after(7 * DAY - 60_000), NOW), { text: "6 gün kaldı", urgent: false, passed: false });
    assert.deepEqual(deadlineHint(after(DAY + 5 * HOUR), NOW), { text: "1 gün kaldı", urgent: false, passed: false });
  });

  it("counts hours on the last day, and says so when under an hour is left", () => {
    assert.deepEqual(deadlineHint(after(23 * HOUR + 59 * 60_000), NOW), { text: "23 saat kaldı", urgent: true, passed: false });
    assert.deepEqual(deadlineHint(after(HOUR), NOW), { text: "1 saat kaldı", urgent: true, passed: false });
    assert.deepEqual(deadlineHint(after(59 * 60_000), NOW), { text: "1 saatten az kaldı", urgent: true, passed: false });
  });

  it("says the time is up once the deadline has passed", () => {
    assert.deepEqual(deadlineHint(after(0), NOW), { text: "Süresi doldu", urgent: false, passed: true });
    assert.deepEqual(deadlineHint(after(-DAY), NOW), { text: "Süresi doldu", urgent: false, passed: true });
  });

  it("is nothing for a time that is not one", () => {
    assert.equal(deadlineHint("", NOW), null);
    assert.equal(deadlineHint("dün", NOW), null);
  });

  // The API reads an overdue request as expired; a page left open past the
  // deadline does the same rather than offer an action it would refuse.
  it("reads a pending or returned request past its deadline as expired, and no other", () => {
    const at = (state: ApprovalState, ms: number) => effectiveState({ state, deadline_at: after(ms) }, NOW);
    assert.equal(at("pending", HOUR), "pending");
    assert.equal(at("pending", -1), "expired");
    assert.equal(at("returned", -1), "expired");
    assert.equal(at("rejected", -DAY), "rejected");
    assert.equal(at("approved", -DAY), "approved");
  });
});

describe("the words for a request", () => {
  it("names every state", () => {
    assert.deepEqual(APPROVAL_STATE_LABEL, {
      pending: "Onay bekliyor",
      returned: "Sunana döndü",
      approved: "Onaylandı",
      rejected: "Reddedildi",
      declined: "Düzenleme kabul edilmedi",
      expired: "Süresi doldu",
    });
  });

  const event = (kind: ApprovalEvent["kind"], actor: ApprovalEvent["actor"] = { sub: "s", name: "Ayşe Yılmaz" }): ApprovalEvent => ({
    seq: 1,
    kind,
    actor,
    note: null,
    changes: [],
    task_id: null,
    at: NOW.toISOString(),
  });

  it("says what each event was, and who did it; SkyMail expires a request", () => {
    assert.equal(eventLabel(event("submitted")), "Onaya sundu");
    assert.equal(eventLabel(event("resubmitted")), "Yeniden onaya sundu");
    assert.equal(eventLabel(event("edited")), "Değişkenleri düzenledi");
    assert.equal(eventLabel(event("returned")), "Düzenlemeyi sunana geri gönderdi");
    assert.equal(eventLabel(event("accepted")), "Düzenlemeyi kabul etti; gönderildi");
    assert.equal(eventLabel(event("declined")), "Düzenlemeyi kabul etmedi");
    assert.equal(eventLabel(event("approved")), "Onayladı; gönderildi");
    assert.equal(eventLabel(event("rejected")), "Reddetti");
    assert.equal(eventLabel(event("expired", null)), "7 gün içinde karar verilmediği için süresi doldu; gönderilmedi");
    assert.equal(eventActorName(event("approved")), "Ayşe Yılmaz");
    assert.equal(eventActorName(event("approved", { sub: "s", name: " " })), "Adı bilinmeyen üye");
    assert.equal(eventActorName(event("expired", null)), "SkyMail");
  });

  it("names the submitter by name, else by address", () => {
    assert.equal(submitterName({ sub: "s", name: "Ali Can", email: "ali@ornek.com" }), "Ali Can");
    assert.equal(submitterName({ sub: "s", name: null, email: "ali@ornek.com" }), "ali@ornek.com");
    assert.equal(submitterName({ sub: "s", name: "", email: null }), "Adı bilinmeyen üye");
  });
});

describe("what an action's notification says", () => {
  it("is nothing when everyone it was for was told", () => {
    assert.equal(notificationNote(undefined), null);
    assert.equal(notificationNote({ template_key: "mail.approval-requested", notified: 3, problem: null }), null);
  });

  it("says who was not told, and why, in words", () => {
    assert.equal(
      notificationNote({ template_key: "mail.approval-requested", notified: 0, problem: "no_approvers" }),
      "Onaycılara bildirim gitmedi: skymail:mails:approve rolü olan ve e-posta adresi bilinen kimse yok. İstek yine de bekliyor; bir onaycıya haber ver.",
    );
    assert.equal(
      notificationNote({ template_key: "mail.approval-requested", notified: 0, problem: "approver_lookup_failed" }),
      "Onaycılar Keycloak'tan zamanında alınamadı; bildirim gitmedi. İstek yine de bekliyor; bir onaycıya haber ver.",
    );
    assert.equal(
      notificationNote({ template_key: "mail.approval-resolved", notified: 0, problem: "unverified_address" }),
      "Sunanın e-posta adresi Keycloak'ta doğrulanmamış; karar ona mail olarak gitmedi, bu sayfadan görebilir.",
    );
    assert.equal(
      notificationNote({ template_key: "mail.approval-resolved", notified: 0, problem: "template_unavailable" }),
      "Bildirim maili gönderilemedi: mail.approval-resolved System template'i SkyMail'de yok.",
    );
    assert.match(notificationNote({ template_key: "mail.approval-resolved", notified: 0, problem: "something_new" }) ?? "", /bildirim/i);
  });
});

describe("who a request goes to", () => {
  const LIST_ID = "3f0c1a52-0000-4000-8000-000000000001";
  const PEOPLE = [
    { full_name: "Ali Can", email: "ali@ornek.com" },
    { full_name: "", email: "zeynep@ornek.com" },
    { full_name: "Mert Demir", email: "mert@ornek.com" },
    { full_name: "Ece Ak", email: "ece@ornek.com" },
  ];
  const nobody = { mail_list_id: null, name: null, source: null, recipient_full_name: null, recipient_email: null };
  const toList: ApprovalItem["audience"] = { ...nobody, kind: "mailing_list", mail_list_id: LIST_ID, name: "GECEKODU katılımcıları", source: "internal" };
  const toOne: ApprovalItem["audience"] = { ...nobody, kind: "single", recipient_full_name: "Ali Can", recipient_email: "ali@ornek.com" };
  const toMany: ApprovalItem["audience"] = { ...nobody, kind: "people" };
  const submitter = { sub: "s", name: "Ayşe Yılmaz", email: "ayse@ornek.com" };
  const preview = (full_name: string, email: string): MailApproval["preview"] => ({
    subject: "Duyuru",
    html: "<p>…</p>",
    plain_text: "…",
    rendered_for: { full_name, email },
  });

  it("is its people in the order submitted, and nobody for a list", () => {
    assert.deepEqual(approvalPeople({ audience: toMany, recipients: PEOPLE }), PEOPLE);
    assert.deepEqual(approvalPeople({ audience: toOne, recipients: [PEOPLE[0]] }), [PEOPLE[0]]);
    assert.deepEqual(approvalPeople({ audience: toList, recipients: [] }), []);
  });

  // Ticket 19's API had no recipients: one person was named in the audience.
  it("is the one person an older API named in the audience", () => {
    assert.deepEqual(approvalPeople({ audience: toOne }), [{ full_name: "Ali Can", email: "ali@ornek.com" }]);
    assert.deepEqual(approvalPeople({ audience: { ...toOne, recipient_full_name: null } }), [{ full_name: "", email: "ali@ornek.com" }]);
    assert.deepEqual(approvalPeople({ audience: toList }), []);
  });

  it("is said as a send's list or group is, one person by name and address, and several by the first few and how many more", () => {
    assert.deepEqual(approvalAudience({ audience: toList, recipients: [] }), {
      kind: "list",
      name: "GECEKODU katılımcıları",
      detail: null,
      listId: LIST_ID,
    });
    assert.deepEqual(approvalAudience({ audience: toOne }), { kind: "person", name: "Ali Can", detail: "ali@ornek.com", listId: null });
    assert.deepEqual(approvalAudience({ audience: toMany, recipients: PEOPLE }), {
      kind: "people",
      name: "Ali Can, zeynep@ornek.com",
      detail: null,
      listId: null,
      more: 2,
    });
    assert.deepEqual(approvalAudience({ audience: toMany, recipients: PEOPLE }, 3).name, "Ali Can, zeynep@ornek.com, Mert Demir");
    assert.equal(approvalAudience({ audience: toMany, recipients: PEOPLE }, 3).more, 1);
    assert.equal(approvalAudience({ audience: toMany, recipients: PEOPLE.slice(0, 2) }).more, 0);
  });

  it("has a send for each person at their place once approved, and an older API's one send", () => {
    assert.deepEqual(approvalSends({ task_ids: ["t1", "t2"], task_id: "t1" }), ["t1", "t2"]);
    assert.deepEqual(approvalSends({ task_ids: [], task_id: null }), []);
    assert.deepEqual(approvalSends({ task_id: "t1" }), ["t1"]);
    assert.deepEqual(approvalSends({ task_id: null }), []);
  });

  it("is previewed for the person the API names, even when the preview did not render", () => {
    const request = { audience: toMany, recipients: PEOPLE, submitter, preview: null };
    assert.deepEqual(previewRecipient({ ...request, preview_recipient: PEOPLE[2] }), PEOPLE[2]);
    // An older API: as the preview was rendered, else the one person, else the submitter as if on the list.
    assert.deepEqual(previewRecipient({ ...request, preview: preview("Ali Can", "ali@ornek.com") }), { full_name: "Ali Can", email: "ali@ornek.com" });
    assert.deepEqual(previewRecipient({ audience: toOne, submitter, preview: null }), { full_name: "Ali Can", email: "ali@ornek.com" });
    assert.deepEqual(previewRecipient({ audience: toList, submitter, preview: null }), { full_name: "Ayşe Yılmaz", email: "ayse@ornek.com" });
    assert.deepEqual(previewRecipient({ audience: toList, submitter: { sub: "s", name: null, email: null }, preview: null }), {
      full_name: "Adı bilinmeyen üye",
      email: "",
    });
  });

  it("says whose name the preview reads with, and that everyone gets their own", () => {
    const whole = (overrides: Partial<Pick<MailApproval, "audience" | "recipients" | "preview_recipient">>) => ({
      audience: toList,
      recipients: [],
      submitter,
      preview: preview("Ayşe Yılmaz", "ayse@ornek.com"),
      preview_recipient: { full_name: "Ayşe Yılmaz", email: "ayse@ornek.com" },
      ...overrides,
    });
    assert.equal(previewNote(whole({})), "Listedeki her alıcı kendi adıyla alır; önizleme Ayşe Yılmaz <ayse@ornek.com> için, sunucunun göndereceği hâliyle.");
    assert.equal(
      previewNote(whole({ audience: toOne, recipients: [PEOPLE[0]], preview_recipient: PEOPLE[0] })),
      "Ali Can <ali@ornek.com> için, sunucunun göndereceği hâliyle.",
    );
    assert.equal(
      previewNote(whole({ audience: toMany, recipients: PEOPLE, preview_recipient: PEOPLE[0] })),
      "Her kişi kendi adıyla alır; önizleme ilk kişi, Ali Can <ali@ornek.com> için, sunucunun göndereceği hâliyle.",
    );
    assert.equal(
      previewNote(whole({ audience: toMany, recipients: PEOPLE.slice(1), preview_recipient: PEOPLE[1] })),
      "Her kişi kendi adıyla alır; önizleme ilk kişi, zeynep@ornek.com için, sunucunun göndereceği hâliyle.",
    );
  });
});
