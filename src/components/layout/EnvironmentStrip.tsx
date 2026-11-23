// Copied from the admin panel (core-frontend src/components/layout/EnvironmentStrip.tsx,
// PR #144) so every console marks the sandbox alike. Goes away once skylcn-ui's AppShell
// takes an `environment` (top bar standard, S1; Kaan).

import { Badge } from '@skylab-kulubu/skylcn-ui';

/**
 * A thin band across the top of every page in the sandbox, so no one works in
 * the wrong one; production draws nothing. It sits over the page and takes no
 * clicks. Under the top bar it is the line alone (the bar carries the badge).
 */
export function EnvironmentStrip({ sandbox }: { sandbox: boolean }) {
  if (!sandbox) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-60">
      <div className="bg-warning absolute inset-x-0 top-0 h-0.5" />
    </div>
  );
}

/** The environment in the top bar, beside the account: drawn only in the sandbox. */
export function EnvironmentBadge({ sandbox }: { sandbox: boolean }) {
  if (!sandbox) return null;
  return (
    <span role="note" aria-label="Ortam: Sandbox" className="shrink-0">
      <Badge tone="warning" className="text-xs">
        Sandbox
      </Badge>
    </span>
  );
}
