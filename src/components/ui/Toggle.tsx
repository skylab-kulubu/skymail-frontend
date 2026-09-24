'use client';

// Copied from superadmin (ADR-0017), with the chrome's colours and the switch
// role so a screen reader announces its state.

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeLabel?: string;
  inactiveLabel?: string;
}

export function Toggle({
  checked,
  onChange,
  activeLabel = 'Aktif',
  inactiveLabel = 'Pasif',
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? activeLabel : inactiveLabel}
      onClick={() => onChange(!checked)}
      className="focus-visible:ring-skylab-400/40 relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2"
    >
      <div
        className={`absolute h-full w-full rounded-full border transition-colors ${
          checked ? 'border-skylab-400/60 bg-skylab-500/40' : 'border-white/10 bg-neutral-800'
        }`}
      />
      <div
        className={`absolute h-4 w-4 rounded-full shadow-md transition-transform duration-200 ${
          checked ? 'bg-skylab-300 translate-x-6' : 'translate-x-1 bg-neutral-400'
        }`}
      />
    </button>
  );
}
