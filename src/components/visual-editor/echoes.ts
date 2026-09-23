/**
 * Which values coming back to the Visual editor are its own. It hands each
 * change out, and the page gives the text back as its value a render or more
 * later — on a busy machine, an older one after a newer keystroke. Only a
 * value it never handed out is a change from outside (a source set back, a
 * reload) and replaces the content; mistaking a late echo for one would throw
 * away what was typed since.
 */
export interface Echoes {
  /** The editor handed this text out. */
  handedOut(text: string): void;
  /** Whether a value the page gives back is a change from outside; if so it becomes the latest. */
  isOutside(value: string): boolean;
}

export function createEchoes(initial: string): Echoes {
  let latest = initial;
  // Handed out and not seen back yet: any of them may still arrive late.
  const inFlight = new Set<string>();
  return {
    handedOut(text) {
      inFlight.add(text);
      latest = text;
    },
    isOutside(value) {
      if (value === latest) {
        // The page has caught up; nothing older will come back.
        inFlight.clear();
        return false;
      }
      if (inFlight.has(value)) return false;
      latest = value;
      inFlight.clear();
      return true;
    },
  };
}
