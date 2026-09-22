import type { ReactNode } from 'react';

// Tones from the chrome's token set, which the light theme redefines, so a tag
// reads on both backgrounds.
const TONES = {
  external: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  archived: 'border-white/15 bg-white/5 text-neutral-400',
} as const;

/** A small label beside a name: Harici for a Keycloak group, Arşivli for an archived record. */
export function Tag({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span
      className={`text-3xs inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 font-medium tracking-[0.14em] uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
