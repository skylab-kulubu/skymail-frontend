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
  sample: Record<string, unknown>;
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
