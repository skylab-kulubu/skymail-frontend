// Only tones the light theme redefines (globals.css): emerald, amber and red
// 300/400, the neutral scale and "white" washes. The send statuses, the home
// screen's tiles and the Mail template versions use the same tones.
export const TONE = {
  good: {
    badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/40',
    text: 'text-emerald-300',
  },
  busy: {
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-400 shadow-[0_0_6px] shadow-amber-400/40',
    text: 'text-amber-300',
  },
  bad: {
    badge: 'border-red-400/30 bg-red-400/10 text-red-300',
    dot: 'bg-red-400 shadow-[0_0_6px] shadow-red-400/40',
    text: 'text-red-300',
  },
  idle: {
    badge: 'border-white/10 bg-white/5 text-neutral-300',
    dot: 'bg-neutral-500',
    text: 'text-neutral-100',
  },
} as const;

export type Tone = keyof typeof TONE;

/** A status in a few words, with a dot of its tone. */
export function ToneBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={`text-2xs inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium whitespace-nowrap ${TONE[tone].badge}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${TONE[tone].dot}`} aria-hidden />
      {label}
    </span>
  );
}
