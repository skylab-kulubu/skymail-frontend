/**
 * Open and click tracking on the send form (hub ticket iletisim-servisi 15a,
 * skymail-backend 14a/14b; Yusuf 2026-10-20: people too): the box is offered
 * only while SkyMail's tracking is on (`GET /mail_tasks/summary`
 * tracking_available) and only for a send the backend may track — to a list
 * or to people, of a template that is neither a System template (account and
 * transaction mails) nor sensitive; to people, only a template that says its
 * content may be shown. Forms sends never get it. The box starts unticked; a
 * send that asked for it but came back untracked says so, and the
 * confirmation says who will not be tracked for want of a known account.
 * While SkyMail tracks every send a person makes (summary tracking_always;
 * Yusuf 2026-10-21) there is no box and every list and people send asks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../api/errors";
import { TEST_BASE_URL, json, scriptedClient } from "../api/testing";
import type { MailTemplate } from "../templates";
import type { SendPlan } from "./send";
import {
  TRACKING_LABEL,
  TRACKING_NOT_APPLIED,
  TRACKING_UNKNOWN,
  fetchTrackingMode,
  peopleTrackingDropped,
  untrackedCount,
  untrackedRecipientsNote,
  trackingAlways,
  trackingAsked,
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

  it("is offered for people only with a template that says its content may be shown", () => {
    assert.equal(offered({ audience: "people", template: template({ content_sensitive: false }) }), true);
    assert.equal(offered({ audience: "people" }), false);
    assert.equal(offered({ audience: "people", template: template({ content_sensitive: true }) }), false);
    assert.equal(offered({ audience: "people", template: template({ content_sensitive: false, system: true }) }), false);
    assert.equal(offered({ audience: "people", template: template({ content_sensitive: false, content_sensitive_locked: true }) }), false);
    assert.equal(offered({ audience: "people", available: false, template: template({ content_sensitive: false }) }), false);
  });

  it("is never offered for a Forms source", () => {
    assert.equal(offered({ audience: "form" }), false);
    assert.equal(offered({ audience: "form", template: template({ content_sensitive: false }) }), false);
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
    // To people a template that says nothing counts as sensitive.
    assert.equal(templateTrackable(template(), "people"), false);
    assert.equal(templateTrackable(template({ content_sensitive: false }), "people"), true);
    assert.equal(templateTrackable(template({ content_sensitive: false }), "list"), true);
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

  it("reads tracking_always only beside tracking on", () => {
    assert.equal(trackingAlways({ tracking_available: true, tracking_always: true }), true);
    assert.equal(trackingAlways({ tracking_available: true, tracking_always: false }), false);
    assert.equal(trackingAlways({ tracking_available: true }), false);
    assert.equal(trackingAlways({ tracking_available: false, tracking_always: true }), false);
  });

  it("asks the tracking mode, which needs no mails:read", async () => {
    const { api, calls } = scriptedClient(json(200, { tracking_available: true, tracking_always: true }));
    assert.deepEqual(await fetchTrackingMode(api, { canReadSummary: false }), { available: true, always: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${TEST_BASE_URL}/mail_tasks/tracking-mode`);
  });

  it("falls back to the smallest summary on a backend before the tracking mode, only for one who may read it", async () => {
    const notFound = () => json(404, { code: "server.not_found", message: "Not Found" });
    const { api, calls } = scriptedClient(notFound(), json(200, { tracking_available: true }));
    assert.deepEqual(await fetchTrackingMode(api, { canReadSummary: true }), { available: true, always: false });
    assert.equal(calls[1].url, `${TEST_BASE_URL}/mail_tasks/summary?days=1&recent=1`);
    const without = scriptedClient(notFound());
    assert.deepEqual(await fetchTrackingMode(without.api, { canReadSummary: false }), TRACKING_UNKNOWN);
    assert.equal(without.calls.length, 1);
  });

  it("is off for a backend that does not say, and not always for one before tracking_always", async () => {
    assert.deepEqual(await fetchTrackingMode(scriptedClient(json(200, {})).api, { canReadSummary: true }), TRACKING_UNKNOWN);
    assert.deepEqual(await fetchTrackingMode(scriptedClient(json(200, { tracking_available: true })).api, { canReadSummary: true }), { available: true, always: false });
  });

  it("passes a refused tracking mode on as the API's error", async () => {
    const { api } = scriptedClient(json(403, { code: "server.forbidden", message: "Forbidden" }));
    const error = await fetchTrackingMode(api, { canReadSummary: true }).catch((reason: unknown) => reason);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
  });
});

describe("while every send is tracked", () => {
  const always = { available: true, always: true } as const;
  const asked = (overrides: Partial<Parameters<typeof trackingAsked>[0]> = {}) =>
    trackingAsked({ mode: always, audience: "list", template: template(), ticked: false, ...overrides });

  it("offers no box", () => {
    assert.equal(offered({ always: true }), false);
    assert.equal(offered({ always: true, audience: "people", template: template({ content_sensitive: false }) }), false);
  });

  it("asks for tracking on every list and people send, whatever the template, with no box ticked", () => {
    assert.equal(asked(), true);
    assert.equal(asked({ audience: "people" }), true);
    assert.equal(asked({ template: template({ system: true }) }), true);
    assert.equal(asked({ template: template({ content_sensitive: true }) }), true);
    assert.equal(asked({ template: template({ content_sensitive_locked: true }), audience: "people" }), true);
  });

  it("never asks for a Forms send", () => {
    assert.equal(asked({ audience: "form" }), false);
    assert.equal(asked({ audience: "form", ticked: true }), false);
  });

  it("asks as the box says otherwise, and never while tracking is off or unknown", () => {
    const on = { available: true, always: false } as const;
    assert.equal(asked({ mode: on, ticked: true }), true);
    assert.equal(asked({ mode: on, ticked: false }), false);
    assert.equal(asked({ mode: on, ticked: true, template: template({ system: true }) }), false);
    assert.equal(asked({ mode: on, ticked: true, audience: "people" }), false);
    assert.equal(asked({ mode: TRACKING_UNKNOWN, ticked: true }), false);
    assert.equal(asked({ mode: { available: false, always: true }, ticked: true }), false);
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

describe("a send to people that asked for tracking", () => {
  const sent = { name: "Ayşe", email: "ayse@ornek.com", status: "sent", sendId: "b1c2d3e4-0000-4000-8000-000000000001" } as const;
  it("says so when a sent one came back untracked", () => {
    assert.equal(peopleTrackingDropped([{ tracking: true }], [{ ...sent, tracking: false }]), TRACKING_NOT_APPLIED);
  });
  it("says nothing when they got it, did not ask, failed, or the backend did not answer the field", () => {
    assert.equal(peopleTrackingDropped([{ tracking: true }], [{ ...sent, tracking: true }]), null);
    assert.equal(peopleTrackingDropped([{}], [{ ...sent, tracking: false }]), null);
    assert.equal(peopleTrackingDropped([{ tracking: true }], [sent]), null);
    assert.equal(peopleTrackingDropped([{ tracking: true }], [{ name: "Ali", email: "ali@ornek.com", status: "final", reason: "x" }]), null);
  });
});

describe("who a tracked send will not track", () => {
  const person = (email: string) => ({ template_id: "t", recipient_email: email, recipient_full_name: "", body_variables: {}, tracking: true });
  const people: SendPlan = { kind: "people", requests: [person("a@ornek.com"), person("b@ornek.com"), person("c@ornek.com")] };
  const listPlan: SendPlan = { kind: "list", request: { template_id: "t", mail_list_id: "l", body_variables: {}, tracking: true } };
  it("cannot count people typed in, nor a Forms source's respondents: their accounts are found when the send is queued", () => {
    assert.equal(untrackedCount(people, null, null), null);
    const form = { kind: "form", request: { template_id: "t", form_source_id: "f", body_variables: {} }, source: {} } as unknown as SendPlan;
    assert.equal(untrackedCount(form, null, null), null);
    assert.equal(untrackedRecipientsNote(untrackedCount(people, null, null)), "Hesabı olmayan alıcılar takip edilmez.");
  });
  it("counts an internal list's members, unknown while its size is; a Keycloak group's members all have an account", () => {
    assert.equal(untrackedCount(listPlan, { external: false }, 12), 12);
    assert.equal(untrackedCount(listPlan, { external: false }, null), null);
    assert.equal(untrackedCount(listPlan, { external: true }, 40), 0);
  });
  it("says it in one short sentence, without a number when it is not known, and nothing when there are none", () => {
    assert.equal(untrackedRecipientsNote(3), "Hesabı bilinmeyen 3 alıcı takip edilmez.");
    assert.equal(untrackedRecipientsNote(1532), "Hesabı bilinmeyen 1.532 alıcı takip edilmez.");
    assert.equal(untrackedRecipientsNote(null), "Hesabı olmayan alıcılar takip edilmez.");
    assert.equal(untrackedRecipientsNote(0), null);
  });
});
