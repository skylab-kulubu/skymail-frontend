import type { ReactNode } from 'react';

/** A section's small heading with a rule after it, as SkyForms' dashboard titles its panels. */
export function SectionTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 id={id} className="text-2xs font-medium text-subtle-foreground">
        {children}
      </h2>
      <span className="h-px flex-1 bg-muted" aria-hidden />
      {aside ? <div className="text-2xs shrink-0 text-subtle-foreground">{aside}</div> : null}
    </div>
  );
}
