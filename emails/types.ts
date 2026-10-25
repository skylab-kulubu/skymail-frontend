import type { Brand } from "./theme";

/**
 * What the seed script needs in order to put a template into SkyMail, beside
 * the rendered HTML. `sample` is never sent: it is what the preview and the
 * design review render with, so a template is judged with realistic values
 * rather than with its own `{{.placeholders}}`.
 */
export interface TemplateMeta {
  /** Stable handle a service addresses this template by. */
  key: string;
  /** Shown in the SkyMail template list. */
  name: string;
  /**
   * Rendered by Go's text/template. A variable that is missing at send time
   * prints `<no value>` here, so only reference variables the sender always
   * supplies — when in doubt, keep the subject literal.
   */
  subject: string;
  /** Protected from archiving, because another service calls it by key. */
  system: boolean;
  /**
   * Whether SkyMail shows what a send of it said masked: every code and
   * one-time link hidden by the server, the rest as sent (skymail-backend,
   * 2026-10-13; before, it was not shown at all). True for mail that carries
   * a code, a one-time or account link, a ticket code or a device's address —
   * anything that lets someone who reads it act as the recipient, or that the
   * recipient alone should see. False for mail whose content an operator may
   * read: the club's own writing, a notice. The seed writes it to the
   * template's `content_sensitive`; every template states it.
   */
  contentSensitive: boolean;
  /** Decides the footer. */
  brand: Brand;
  /** Who sends it and when — documentation for whoever edits it next. */
  trigger: string;
  /** Variables the sender must provide, beside Email and FullName. */
  variables: string[];
  /**
   * The contract Required variables: the few the sending service always passes
   * and the mail cannot do its job without — a reset link, a certificate's
   * VerifyURL — not every variable it sends. The Template seed writes them to
   * SkyMail, which refuses any save or publish whose body stops referencing
   * one, and the panel shows them locked, with their reason. Only what the
   * sender's code is known to pass, always, belongs here. Every System
   * template states its set, empty when nothing qualifies or nothing sends it
   * yet.
   */
  requiredVariables?: RequiredVariable[];
  /**
   * The variables that carry a code or a one-time link, at the top level,
   * sorted. The Template seed writes them to SkyMail's `sensitive_variables`,
   * and a sensitive send's masking hides each one whole, whatever its name or
   * shape (skymail-backend #65); the rest stay readable. List only what
   * SkyMail already masks by name: a list makes masking certain, it must not
   * hide more (sensitive-variables.test.ts). Left out, the seed sends nothing
   * and SkyMail keeps the list the template has; [] clears it.
   */
  sensitiveVariables?: string[];
  sample: Record<string, unknown>;
  /**
   * The Notification type of the same key (skymail-backend
   * docs/notifications.md, ADR 0070), for a template a service sends through
   * `POST /v1/notifications`: the seed writes it after the template with
   * `PUT /v1/notification_types/{key}`. Left out, the template is no
   * Notification type and the seed writes none.
   */
  notification?: NotificationTypeMeta;
}

/** A Notification type as the seed writes it. */
export interface NotificationTypeMeta {
  /** The preference category; null for none (a required type has none). */
  category: string | null;
  /** A required type does not look at preferences (a login code, a ticket). */
  required: boolean;
  /** The channels it goes by. */
  defaultChannels: ("email" | "inbox")[];
  /** system never waits behind a bulk send. */
  lane: "system" | "bulk";
  /**
   * The inbox item's text, Go text/template over the notification's
   * variables only (no `.FullName`, no `.Email`; a missing variable is an
   * error, not empty). Required when defaultChannels holds inbox. `link` is
   * an in-app path (`/events/…`) or an https address on yildizskylab.com
   * with its host written out.
   */
  inbox?: { title: string; summary: string; link: string };
}

/** A contract Required variable and why the mail needs it. */
export interface RequiredVariable {
  /** The variable, as the body reaches it with `.name`. */
  name: string;
  /**
   * Why the mail cannot do without it, in one Turkish sentence an operator
   * reads in the panel and in a refused save. At most 300 characters.
   */
  reason: string;
}
