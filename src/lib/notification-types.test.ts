import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { channelsLabel, notificationTypeLine, parseNotificationTypes } from "./notification-types";

const ticket = {
  key: "event.ticket-created",
  category: null,
  required: true,
  default_channels: ["email", "inbox"],
  lane: "system",
  archived_at: null,
  inbox: { title: "{{.EventName}} biletin hazır", summary: "", link: "/events/{{.EventId}}" },
};

describe("notification types", () => {
  it("reads SkyMail's list by key", () => {
    const types = parseNotificationTypes([ticket, { ...ticket, key: "event.reminder", required: false, category: "events", default_channels: ["inbox"], lane: "bulk", archived_at: "2026-10-25T09:00:00Z" }]);
    assert.ok(types);
    assert.deepEqual(types.get("event.ticket-created"), {
      key: "event.ticket-created",
      category: null,
      required: true,
      channels: ["email", "inbox"],
      lane: "system",
      archived: false,
    });
    assert.equal(types.get("event.reminder")?.archived, true);
  });

  it("leaves out a channel it does not know and refuses a body that is not the list", () => {
    assert.deepEqual(parseNotificationTypes([{ ...ticket, default_channels: ["email", "push"] }])?.get(ticket.key)?.channels, ["email"]);
    assert.equal(parseNotificationTypes({ items: [] }), null);
    assert.equal(parseNotificationTypes([{ ...ticket, lane: "fast" }]), null);
    assert.equal(parseNotificationTypes([{ ...ticket, required: "yes" }]), null);
  });

  it("says a type in one line", () => {
    const types = parseNotificationTypes([
      ticket,
      { ...ticket, key: "a", required: false, category: "events", default_channels: ["inbox"] },
      { ...ticket, key: "b", required: false, category: null, default_channels: [], archived_at: "2026-10-25T09:00:00Z" },
    ]);
    assert.ok(types);
    assert.equal(notificationTypeLine(types.get(ticket.key)!), "Zorunlu · E-posta, Uygulama içi kutu");
    assert.equal(notificationTypeLine(types.get("a")!), "Kategori: events · Uygulama içi kutu");
    assert.equal(notificationTypeLine(types.get("b")!), "İsteğe bağlı · Kanal yok · arşivli");
    assert.equal(channelsLabel(types.get("a")!), "Uygulama içi kutu");
  });
});
