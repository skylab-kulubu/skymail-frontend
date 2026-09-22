/**
 * A template row is saved as the HTML the editor rendered, so a render that did
 * not succeed must never reach the save.
 *
 * The case that makes this urgent: `scripts/seed-templates.ts` writes a pointer
 * comment into `react_email_content` rather than the `.tsx` source, so opening a
 * seeded template loads code that compiles to no component. The render fails,
 * the preview stays empty, and saving would write that empty body over a
 * template a live service sends by key.
 *
 * But refusing every unrendered save would close a door ADR-0045 deliberately
 * opened. It moved Keycloak's system mail into SkyMail so that "every wording
 * change is a Keycloak release" would stop being true, and it rejected the
 * Keycloakify theme precisely for needing "a release per wording change". The
 * API agrees: `UpdateTemplate` lets a system template's content "be reworded
 * freely" and locks only its key. Since all twelve seeded system templates hold
 * a stub that can never render, a blanket refusal would put their subjects back
 * behind a PR and a re-seed.
 *
 * So there are three outcomes, not two. An operator who did not touch the code
 * may still change the wording around it: the stored body travels back
 * unchanged and nothing is rendered over it.
 */
export type TemplateRenderState = {
  code: string;
  renderedCode: string | null;
  previewHtml: string;
  error: string | null;
};

export type SaveDecision =
  /** The editor rendered the code in it; save that render. */
  | "render"
  /** The code was never touched; save the wording and keep the stored body. */
  | "keep"
  /** The code was edited and does not render; saving would destroy the body. */
  | "blocked";

/**
 * `renderedCode === code` is what keeps a save from riding on a stale render —
 * both the one left behind by a since-broken edit and the one the debounce has
 * not caught up with yet.
 *
 * `storedCode` is the `react_email_content` the row was loaded with, and null
 * when there is no row yet, which is why creating a template can only ever
 * reach "render" or "blocked".
 */
export const decideSave = (
  { code, renderedCode, previewHtml, error }: TemplateRenderState,
  storedCode: string | null,
): SaveDecision => {
  if (error === null && previewHtml !== "" && renderedCode === code) {
    return "render";
  }
  return storedCode !== null && code === storedCode ? "keep" : "blocked";
};
