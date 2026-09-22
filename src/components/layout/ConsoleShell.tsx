'use client';

// Copied from superadmin's AuthenticatedChrome (ADR-0017): the sidebar, the
// mobile top bar and the framed content panel. The command palette and the
// event-aware navigation are superadmin's own and stay there.

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { ConsoleProvider, type ConsoleUser } from './ConsoleContext';
import { MobileSidebarContext } from './MobileSidebarContext';
import { RoleGate } from './RoleGate';
import { SessionEndedDialog } from './SessionEndedDialog';
import { Sidebar } from './Sidebar';
import { ApiProvider } from '@/lib/api/react';
import type { PublicConfig } from '@/lib/runtime-config';
import { useBodyScrollLock } from '@/lib/ui/use-body-scroll-lock';

const COLLAPSED_KEY = 'skylab.mail.sidebar-collapsed';

type ConsoleShellProps = Readonly<{
  children: ReactNode;
  roles: readonly string[];
  user: ConsoleUser;
  config: PublicConfig;
}>;

export function ConsoleShell({ children, roles, user, config }: ConsoleShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  useBodyScrollLock(isMobileSidebarOpen);

  useEffect(() => {
    try {
      setIsDesktopSidebarCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === 'true');
    } catch {
      // Storage blocked: start expanded.
    }
  }, []);

  function setDesktopSidebarCollapsed(collapsed: boolean) {
    setIsDesktopSidebarCollapsed(collapsed);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    if (desktop.matches) setIsMobileSidebarOpen(false);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMobileSidebarOpen(false);
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  return (
    <ConsoleProvider roles={roles} user={user} config={config}>
      <ApiProvider baseUrl={config.apiUrl}>
        <MobileSidebarContext.Provider
          value={{
            open: () => setIsMobileSidebarOpen(true),
            close: () => setIsMobileSidebarOpen(false),
            isOpen: isMobileSidebarOpen,
          }}
        >
          <div
            className={`min-h-dvh transition-[padding] duration-200 md:h-dvh md:bg-neutral-950 md:py-2 md:pr-2 ${
              isDesktopSidebarCollapsed ? 'md:pl-18' : 'md:pl-66'
            }`}
          >
            <Sidebar
              isMobileOpen={isMobileSidebarOpen}
              onMobileClose={() => setIsMobileSidebarOpen(false)}
              isDesktopCollapsed={isDesktopSidebarCollapsed}
              onDesktopCollapsedChange={setDesktopSidebarCollapsed}
            />

            <div
              inert={isMobileSidebarOpen || undefined}
              className="sticky top-0 z-40 border-b border-white/5 bg-neutral-950/80 backdrop-blur md:hidden"
            >
              <div className="flex h-14 items-center px-3">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="focus-visible:ring-skylab-400/40 inline-flex items-center justify-center rounded-md p-2 text-neutral-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:outline-none"
                  aria-label="Menüyü aç"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="ml-2 min-w-0 flex-1">
                  <Breadcrumbs />
                </div>
              </div>
            </div>

            <div
              inert={isMobileSidebarOpen || undefined}
              className="md:flex md:h-full md:min-h-0 md:flex-col md:overflow-hidden md:rounded-xl md:border md:border-white/5 md:bg-neutral-900"
            >
              <div className="hidden h-10 shrink-0 items-center gap-4 border-b border-white/5 px-6 md:flex">
                <Breadcrumbs />
              </div>
              <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
                <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
                  <RoleGate>{children}</RoleGate>
                </main>
              </div>
            </div>
          </div>
          <Suspense fallback={null}>
            <SessionEndedDialog />
          </Suspense>
        </MobileSidebarContext.Provider>
      </ApiProvider>
    </ConsoleProvider>
  );
}
