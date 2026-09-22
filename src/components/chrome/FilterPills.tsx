'use client';

// Copied from superadmin's chrome/ListToolbar.tsx (ADR-0017), the filter
// pills only. The active pill's text is skylab-300: the copy's skylab-200 is
// not in this shell's token set, so it painted no colour.

export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex h-8 items-center rounded-md border border-white/10 bg-neutral-900/60 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`focus-visible:ring-skylab-400/40 h-7 rounded px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              active
                ? 'bg-skylab-500/20 text-skylab-300'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
