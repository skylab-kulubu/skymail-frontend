'use client';

// skylcn-ui's AppShell, as the admin panel uses it (core-frontend
// AuthenticatedChrome): the sidebar that collapses to an icon rail (Ctrl/⌘+B),
// the rounded content panel with the breadcrumb row, and on phones a sticky
// top bar with the sidebar in a drawer.

import { AppShell, Breadcrumbs } from '@skylab-kulubu/skylcn-ui';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { ConsoleProvider, type ConsoleUser, type RefreshRoles } from './ConsoleContext';
import { RoleGate } from './RoleGate';
import { SessionEndedDialog } from './SessionEndedDialog';
import { Sidebar } from './Sidebar';
import { ApiProvider } from '@/lib/api/react';
import { shellCrumbs } from '@/lib/chrome-breadcrumbs';
import type { PublicConfig } from '@/lib/runtime-config';

type ConsoleShellProps = Readonly<{
  children: ReactNode;
  roles: readonly string[];
  user: ConsoleUser;
  config: PublicConfig;
  /** The refreshRoles server action, from the layout. */
  refreshRoles: RefreshRoles;
}>;

export function ConsoleShell({ children, roles, user, config, refreshRoles }: ConsoleShellProps) {
  const pathname = usePathname() || '/';
  return (
    <ConsoleProvider roles={roles} user={user} config={config} refreshRoles={refreshRoles}>
      <ApiProvider baseUrl={config.apiUrl}>
        <AppShell
          // Keeps the collapsed choice people made before the move to skylcn-ui
          storageKey="skylab.mail.sidebar-collapsed"
          sidebar={<Sidebar />}
          header={<Breadcrumbs items={shellCrumbs(pathname)} />}
        >
          <RoleGate>{children}</RoleGate>
        </AppShell>
        <Suspense fallback={null}>
          <SessionEndedDialog />
        </Suspense>
      </ApiProvider>
    </ConsoleProvider>
  );
}
