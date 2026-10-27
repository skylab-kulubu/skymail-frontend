/**
 * A send's controls and what its page says about them (hub ticket
 * duyuru-haber 05 G4, 08): pause, resume and cancel through
 * skymail-backend's POST /mail_tasks/:id/{pause,resume,cancel}, and the bulk
 * lane's hold after the relay throttled the account.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { json, scriptedClient, TEST_BASE_URL } from "./api/testing";
import {
  bulkHeldText,
  cancelConfirmText,
  controlNotice,
  controlSend,
  sendControls,
} from "./send-controls";
import { recipientSummary, type Send, type SendSummary } from "./sends";

const SENDER = "31ef736f-72da-4a40-8791-d523199cf9f0";
const WRITER = ["skymail:access", "skymail:mails:read", "skymail:mails:write"];
const ANNOUNCER = ["skymail:access", "skymail:mails:read", "skymail:announcements:send"];

function send(overrides: Partial<Send> = {}): Send {
  return {
    id: "40000000-0000-4000-8000-00000000000a",
    created_at: "2026-10-27T10:00:00Z",
    sent_by: SENDER,
    template_id: null,
    template_name: "club.news",
    template_key: "club.news",
    mail_list_id: null,
    mail_list_name: null,
    audience: { kind: "mailing_list", mail_list_id: "l", name: "Tüm üyeler", source: "internal", recipient_full_name: null, recipient_email: null },
    status: "sending",
    recipient_counts: { pending: 120, processing: 2, sent: 60, failed: 0 },
    paused_at: null,
    paused_reason: null,
    cancelled_at: null,
    ...overrides,
  };
}

describe("which controls a send shows", () => {
  it("pause and cancel while it is going out, to its sender with mails:write", () => {
    assert.deepEqual(sendControls(send(), { roles: WRITER, sub: SENDER }), ["pause", "cancel"]);
  });

  it("resume and cancel once paused", () => {
    assert.deepEqual(sendControls(send({ paused_at: "2026-10-27T10:05:00Z", paused_reason: "operator" }), { roles: WRITER, sub: SENDER }), ["resume", "cancel"]);
  });

  it("none to another list sender; all to who sends to everyone", () => {
    assert.deepEqual(sendControls(send(), { roles: WRITER, sub: "other" }), []);
    assert.deepEqual(sendControls(send(), { roles: ANNOUNCER, sub: "other" }), ["pause", "cancel"]);
  });

  it("none for a single mail, a cancelled send or one with nothing left to send", () => {
    const single = send({ audience: { ...send().audience, kind: "single" } });
    assert.deepEqual(sendControls(single, { roles: ANNOUNCER, sub: SENDER }), []);
    assert.deepEqual(sendControls(send({ cancelled_at: "2026-10-27T10:06:00Z" }), { roles: ANNOUNCER, sub: SENDER }), []);
    const done = send({ status: "sent", recipient_counts: { pending: 0, processing: 0, sent: 182, failed: 0 } });
    assert.deepEqual(sendControls(done, { roles: ANNOUNCER, sub: SENDER }), []);
    // A paused send whose rows are all handled may still be resumed (nothing to cancel).
    assert.deepEqual(sendControls({ ...done, paused_at: "x", paused_reason: "operator" }, { roles: ANNOUNCER, sub: SENDER }), ["resume"]);
  });
});

describe("what the send's page says", () => {
  it("a paused send, by hand or by its failures; a cancelled one", () => {
    assert.match(controlNotice(send({ paused_at: "2026-10-27T10:05:00Z", paused_reason: "operator" }))!.title, /Duraklatıldı/);
    const failing = controlNotice(send({ paused_at: "2026-10-27T10:05:00Z", paused_reason: "failure_rate" }))!;
    assert.match(failing.title, /kendiliğinden/i);
    assert.equal(failing.tone, "danger");
    const cancelled = controlNotice(send({ cancelled_at: "2026-10-27T10:06:00Z", recipient_counts: { pending: 0, processing: 0, sent: 60, failed: 122, cancelled: 122 } }))!;
    assert.match(cancelled.title, /İptal edildi/);
    assert.match(cancelled.text, /122 alıcı atlandı/);
    assert.equal(controlNotice(send()), null);
  });

  it("asks before a cancel, naming who will not get it", () => {
    assert.match(cancelConfirmText(send()), /Bekleyen 120 alıcıya/);
    assert.match(cancelConfirmText(send()), /geri alınamaz/);
  });

  it("counts cancelled recipients apart from failed ones", () => {
    const summary = recipientSummary({ pending: 0, processing: 0, sent: 60, failed: 125, cancelled: 122 });
    assert.deepEqual(summary.parts, ["60 gönderildi", "3 başarısız", "122 iptal edildi"]);
    assert.equal(summary.total, 185);
  });
});

describe("controls and the hold", () => {
  it("post to the send's control and answer the send", async () => {
    const { api, calls } = scriptedClient(json(200, send({ paused_at: "2026-10-27T10:05:00Z", paused_reason: "operator" })));
    const paused = await controlSend(api, send().id, "pause");
    assert.equal(paused.paused_reason, "operator");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks/${send().id}/pause`);
  });

  it("says while the bulk lane is held, and until when", () => {
    const summary = { bulk_held_until: "2026-10-27T10:10:00Z" } as Partial<SendSummary> as SendSummary;
    assert.match(bulkHeldText(summary, new Date("2026-10-27T10:06:00Z"))!, /yavaşlat/);
    assert.equal(bulkHeldText(summary, new Date("2026-10-27T10:11:00Z")), null);
    assert.equal(bulkHeldText({} as SendSummary), null);
  });
});
