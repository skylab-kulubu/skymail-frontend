// Copied from superadmin (ADR-0017). The links come from the runtime config
// rather than NEXT_PUBLIC_* values baked into the build.
import { ClipboardList, LayoutDashboard } from 'lucide-react';
import type { ConsoleLink } from '@/lib/runtime-config';

const CONSOLE_ICON = { admin: LayoutDashboard, forms: ClipboardList } as const;

export function ClubSwitcher({
  consoles,
  collapsed = false,
}: {
  consoles: readonly ConsoleLink[];
  collapsed?: boolean;
}) {
  return (
    <nav aria-label="Kulüp konsolları" className="space-y-1">
      {consoles.map((app) => {
        const Icon = CONSOLE_ICON[app.id];
        return (
          <a
            key={app.id}
            href={app.href}
            aria-label={collapsed ? app.label : undefined}
            title={collapsed ? app.label : undefined}
            className={`flex min-h-9 items-center rounded-md py-2 text-sm text-neutral-400 hover:bg-white/5 hover:text-neutral-100 ${
              collapsed ? 'justify-center px-1' : 'gap-3 px-2'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {collapsed ? null : app.label}
          </a>
        );
      })}
    </nav>
  );
}
