import { useEffect, type RefObject } from 'react';

export function useBackgroundInert(
  active: boolean,
  foregroundRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) return;
    const foreground = foregroundRef.current;
    if (!foreground) return;
    const background = Array.from(document.body.children).filter(
      (element) => element !== foreground,
    );
    const previous = background.map((element) => ({
      element,
      inert: (element as HTMLElement).inert,
    }));
    for (const { element } of previous) (element as HTMLElement).inert = true;
    return () => {
      for (const item of previous) (item.element as HTMLElement).inert = item.inert;
    };
  }, [active, foregroundRef]);
}
