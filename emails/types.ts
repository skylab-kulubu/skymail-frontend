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
  sample: Record<string, unknown>;
}
