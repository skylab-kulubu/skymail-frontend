/**
 * Notification types (skymail-backend `docs/notifications.md`, ADR 0070):
 * what core may send a person by `POST /v1/notifications`, each with the
 * Mail template of the same key as its e-mail text. The console shows a
 * template's type beside it (iletişim-servisi 10, dilim 2): its category,
 * whether it is required and its default channels. The Template seed writes
 * the types; the console reads them (`skymail:templates:read`).
 */
import type { ApiClient } from "@/lib/api/client";

export type NotificationChannel = "email" | "inbox";

export type NotificationTypeSummary = Readonly<{
  key: string;
  category: string | null;
  required: boolean;
  channels: readonly NotificationChannel[];
  lane: "system" | "bulk";
  archived: boolean;
}>;

const CHANNEL_LABEL: Readonly<Record<NotificationChannel, string>> = {
  email: "E-posta",
  inbox: "Uygulama içi kutu",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summaryOf(value: unknown): NotificationTypeSummary | null {
  if (!isRecord(value) || typeof value.key !== "string" || typeof value.required !== "boolean") return null;
  if (value.category !== null && typeof value.category !== "string") return null;
  if (value.lane !== "system" && value.lane !== "bulk") return null;
  if (!Array.isArray(value.default_channels)) return null;
  // A channel this console does not know yet (push, sms) is left out, not a failure.
  const channels = value.default_channels.filter((channel): channel is NotificationChannel => channel === "email" || channel === "inbox");
  return {
    key: value.key,
    category: value.category,
    required: value.required,
    channels,
    lane: value.lane,
    archived: value.archived_at !== null && value.archived_at !== undefined,
  };
}

/** `GET /v1/notification_types`'s array, by key; null when it is not that shape. */
export function parseNotificationTypes(body: unknown): ReadonlyMap<string, NotificationTypeSummary> | null {
  if (!Array.isArray(body)) return null;
  const types = new Map<string, NotificationTypeSummary>();
  for (const raw of body) {
    const type = summaryOf(raw);
    if (!type) return null;
    types.set(type.key, type);
  }
  return types;
}

export async function fetchNotificationTypes(api: ApiClient, signal?: AbortSignal) {
  const types = parseNotificationTypes(await api.get<unknown>("/notification_types", { signal }));
  if (!types) throw new Error("Bildirim türleri okunamadı.");
  return types;
}

/** The channels in words, in the order the type lists them: "E-posta, Uygulama içi kutu". */
export function channelsLabel(type: NotificationTypeSummary): string {
  return type.channels.map((channel) => CHANNEL_LABEL[channel]).join(", ") || "Kanal yok";
}

/** One line for the template list: "Zorunlu · E-posta, Uygulama içi kutu", or the category for an optional type. */
export function notificationTypeLine(type: NotificationTypeSummary): string {
  const kind = type.required ? "Zorunlu" : type.category ? `Kategori: ${type.category}` : "İsteğe bağlı";
  return `${kind} · ${channelsLabel(type)}${type.archived ? " · arşivli" : ""}`;
}
