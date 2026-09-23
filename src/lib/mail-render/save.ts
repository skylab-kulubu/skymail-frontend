/**
 * The save rule, on its own so a page can decide a save without loading the
 * renderer: index.ts re-exports it with the rest of the module.
 */
import type { SourceInput, SourceRender } from ".";

/**
 * What a save may write. A template row is saved as the body the editor
 * rendered, so a render that did not succeed must never reach the save: the
 * seed's pointer comment compiled to no component, the preview stayed empty,
 * and saving wrote that empty body over a template a live service sends by
 * key.
 *
 * But refusing every unrendered save would close a door ADR-0045 deliberately
 * opened: a system template's wording is edited in SkyMail without a release,
 * and the stored body of one the editor cannot render still travels back
 * unchanged under a new subject. So there are three outcomes, not two.
 */
export type SaveDecision =
  /** The editor rendered the source in it; save that render. */
  | "render"
  /** The source was never touched; save the wording and keep the stored body. */
  | "keep"
  /** The source was edited and has no render of its own; saving would destroy the body. */
  | "blocked";

/**
 * `editing` is the source in the editor now, `lastRender` the render it last
 * finished, and `storedSource` the source of that Authoring mode the row was
 * loaded with — null when there is none yet, which is why creating a template
 * can only ever reach "render" or "blocked". Keeping the stored body takes the
 * same mode as well as the same text.
 *
 * Comparing the render's source with the editor's is what keeps a save from
 * riding on a stale render: the one a since-broken edit left on screen, and
 * the one the debounce has not replaced yet.
 */
export function decideSave(
  editing: SourceInput,
  lastRender: SourceRender | null,
  storedSource: SourceInput | null,
): SaveDecision {
  const sameAs = (other: SourceInput | null) =>
    other !== null && other.mode === editing.mode && other.source === editing.source;

  if (lastRender?.ok && sameAs(lastRender)) {
    return "render";
  }
  return sameAs(storedSource) ? "keep" : "blocked";
}
