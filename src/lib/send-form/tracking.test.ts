/**
 * Open and click tracking on the send form (hub ticket iletisim-servisi 15a,
 * skymail-backend 14a/14b): the box is offered only while SkyMail's tracking
 * is on (`GET /mail_tasks/summary` tracking_available) and only for a send
 * the backend may track — a list send of a template that is neither a System
 * template (account and transaction mails) nor sensitive. People and Forms
 * sends never get it. The box starts unticked; a send that asked for it but
 * came back untracked says so.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../api/errors";
import { TEST_BASE_URL, json, scriptedClient } from "../api/testing";
import type { MailTemplate } from "../templates";
import {
  TRACKING_LABEL,
  TRACKING_NOT_APPLIED,
  fetchTrackingAvailable,
  trackingAvailable,
  trackingDropped,
  templateTrackable,
  trackingOffered,
} from "./tracking";

function template(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    id: "7e3a1c00-0000-4000-8000-000000000001",
    name: "Etkinlik duyurusu",
    key: null,
    subject: "{{.EventName}}",
    system: false,
    html_content: "<p>{{.EventName}}</p>",
    plain_text_content: "",
    react_email_content: "",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    archived_at: null,
    archived_by: null,
    published_version_id: "9a1b2c00-0000-4000-8000-000000000001",
    content_sensitive: null,
    ...overrides,
  };
}

const offered = (overrides: Partial<Parameters<typeof trackingOffered>[0]> = {}) =>
  trackingOffered({ available: true, audience: "list", template: template(), ...overrides });

describe("the tracking box", () => {
  it("is offered for a list send of an ordinary template while tracking is on", () => {
    assert.equal(offered(), true);
    assert.equal(offered({ template: template({ content_sensitive: false }) }), true);
  });

  it("is never offered while SkyMail's tracking is off", () => {
    assert.equal(offered({ available: false }), false);
  });

  it("is never offered for people or a Forms source", () => {
    assert.equal(offered({ audience: "people" }), false);
    assert.equal(offered({ audience: "form" }), false);
  });

  it("is never offered for a System or sensitive template, nor before a template is picked", () => {
    assert.equal(offered({ template: template({ system: true, key: "account.login_code" }) }), false);
    assert.equal(offered({ template: template({ content_sensitive: true }) }), false);
    assert.equal(offered({ template: template({ content_sensitive_locked: true }) }), false);
    assert.equal(offered({ template: null }), false);
  });

  it("reads a template's trackability as the backend does", () => {
    assert.equal(templateTrackable(template()), true);
    assert.equal(templateTrackable(template({ system: true })), false);
    assert.equal(templateTrackable(template({ content_sensitive: true })), false);
    assert.equal(templateTrackable(template({ content_sensitive_locked: true })), false);
  });

  it("is labelled shortly, without the word for reading", () => {
    assert.equal(TRACKING_LABEL, "Açılma ve tıklama takibi");
    for (const text of [TRACKING_LABEL, TRACKING_NOT_APPLIED]) assert.doesNotMatch(text.toLocaleLowerCase("tr-TR"), /oku/);
  });
});

describe("whether tracking is on", () => {
  it("reads only a true tracking_available as on", () => {
    assert.equal(trackingAvailable({ tracking_available: true }), true);
    assert.equal(trackingAvailable({ tracking_available: false }), false);
    assert.equal(trackingAvailable({}), false);
  });

  it("asks the smallest summary", async () => {
    const { api, calls } = scriptedClient(json(200, { tracking_available: true }));
    assert.equal(await fetchTrackingAvailable(api), true);
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks/summary?days=1&recent=1`);
  });

  it("is off for a backend that does not say", async () => {
    const { api } = scriptedClient(json(200, { sender_paused: false }));
    assert.equal(await fetchTrackingAvailable(api), false);
  });

  it("passes a refused summary on as the API's error", async () => {
    const { api } = scriptedClient(json(403, { code: "server.forbidden", message: "Forbidden" }));
    const error = await fetchTrackingAvailable(api).catch((reason: unknown) => reason);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
  });
});

describe("a send that asked for tracking", () => {
  it("says so when the answer is untracked", () => {
    assert.equal(trackingDropped(true, false), TRACKING_NOT_APPLIED);
  });

  it("says nothing when it got tracking, did not ask, or the backend did not answer the field", () => {
    assert.equal(trackingDropped(true, true), null);
    assert.equal(trackingDropped(false, false), null);
    assert.equal(trackingDropped(undefined, false), null);
    assert.equal(trackingDropped(true, undefined), null);
  });
});
