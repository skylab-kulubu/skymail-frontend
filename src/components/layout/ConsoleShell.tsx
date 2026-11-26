'use client';

// skylcn-ui's AppShell, as the admin panel uses it (core-frontend
// AuthenticatedChrome): the sidebar that collapses to an icon rail (Ctrl/⌘+B),
// the rounded content panel with the breadcrumb row, and on phones a sticky
// top bar with the sidebar in a drawer. The top bar's right end carries the
// sandbox badge and the person's menu, as in every console; the sidebar has no
// account row.

import { AppShell, AppShellActions, Breadcrumbs } from '@skylab-kulubu/skylcn-ui';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { ConsoleProvider, type ConsoleUser, type RefreshRoles } from './ConsoleContext';
import { EnvironmentBadge, EnvironmentStrip } from './EnvironmentStrip';
import { RoleGate } from './RoleGate';
import { SessionEndedDialog } from './SessionEndedDialog';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';
import { ApiProvider } from '@/lib/api/react';
import { shellCrumbs } from '@/lib/chrome-breadcrumbs';
import { isSandbox } from '@/lib/environment';
import type { PublicConfig } from '@/lib/runtime-config';
import type { TeamAudience } from '@/lib/send-form/teams';

type ConsoleShellProps = Readonly<{
  children: ReactNode;
  roles: readonly string[];
  user: ConsoleUser;
  config: PublicConfig;
  /** The refreshRoles server action, from the layout. */
  refreshRoles: RefreshRoles;
  /** A Leader without skynotify:access: their Teams (TeamSeatGate). */
  teamSeat?: readonly TeamAudience[] | null;
}>;

export function ConsoleShell({ children, roles, user, config, refreshRoles, teamSeat = null }: ConsoleShellProps) {
  const pathname = usePathname() || '/';
  const sandbox = isSandbox(config.apiUrl);
  return (
    <ConsoleProvider roles={roles} user={user} config={config} teamSeat={teamSeat} refreshRoles={refreshRoles}>
      <ApiProvider baseUrl={config.apiUrl}>
        <EnvironmentStrip sandbox={sandbox} />
        <AppShell
          // Keeps the collapsed choice people made before the move to skylcn-ui
          storageKey="skylab.mail.sidebar-collapsed"
          sidebar={<Sidebar />}
          header={<Breadcrumbs items={shellCrumbs(pathname, { teamSeat: teamSeat !== null })} />}
        >
          <AppShellActions>
            <EnvironmentBadge sandbox={sandbox} />
            <UserMenu name={user.name} email={user.email} accountUrl={config.accountUrl} />
          </AppShellActions>
          <RoleGate>{children}</RoleGate>
        </AppShell>
        <Suspense fallback={null}>
          <SessionEndedDialog />
        </Suspense>
      </ApiProvider>
    </ConsoleProvider>
  );
}
