import { useEffect } from 'react';

/**
 * Body kaydırmayı kilitler; kaydırma çubuğu kaybından kaynaklanan yatay sıçramayı
 * padding-right ile telafi etmeye çalışır.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const html = document.documentElement;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [active]);
}
