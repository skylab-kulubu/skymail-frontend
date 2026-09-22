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
 * `renderedCode` is the code the current preview came from. Comparing it to the
 * code in the editor is what keeps a save from riding on a stale render — both
 * the one left behind by a since-broken edit and the one the debounce has not
 * caught up with yet.
 */
export type TemplateRenderState = {
  code: string;
  renderedCode: string | null;
  previewHtml: string;
  error: string | null;
};

export const isSavable = ({
  code,
  renderedCode,
  previewHtml,
  error,
}: TemplateRenderState): boolean =>
  error === null && previewHtml !== "" && renderedCode === code;
