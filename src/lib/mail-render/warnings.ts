/**
 * What a render may still get wrong, found in its two bodies. None of it
 * stops a save: the editor says each warning next to the preview and again
 * before a publish, worded as what to do.
 *
 * One rule so far, from emails:render's six checks (scripts/mail-checks.ts):
 * the plain-text part is derived from the markup, and html-to-text writes a
 * link as its text and then its address, so an address right against the next
 * word reads as one mangled word — "…yildizskylab.comby WEBLAB". emails:render
 * fails a repo template for it; for what an operator writes, in any mode, it
 * is a warning, since only the operator can put the space in. Kept free of
 * the renderer so the page can read a stored body with it.
 */

/**
 * Each place where a link's address runs into a letter in the plain text,
 * as the address and the dozen characters after it.
 *
 * It takes the hrefs the markup actually contains and checks that each ends
 * where it should, rather than guess at the shape of the damage. A letter
 * straight after the address means the next word was glued on; punctuation
 * and path characters are how a longer address continues, and that longer
 * address is its own href and gets checked on its own.
 */
export function gluedLinks(html: string, plainText: string): string[] {
  const glued: string[] = [];
  const hrefs = new Set(
    [...html.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1].replace(/&amp;/g, "&"))
      .filter((href) => /^(https?:|mailto:)/.test(href)),
  );

  for (const href of hrefs) {
    let from = 0;
    for (;;) {
      const at = plainText.indexOf(href, from);
      if (at === -1) {
        break;
      }
      from = at + href.length;

      const next = plainText[from];
      if (next && /\p{L}/u.test(next)) {
        glued.push(plainText.slice(at, from + 12));
      }
    }
  }
  return glued;
}

/** The warnings for a render's two bodies, each saying what to do. */
export function renderWarnings(html: string, plainText: string): string[] {
  return gluedLinks(html, plainText).map(
    (sample) =>
      `Bağlantıdan sonra bir boşluk bırak: düz metinde bağlantı ile sonraki kelime birleşiyor (${sample.replace(/\s+/g, " ").trim()}).`,
  );
}
