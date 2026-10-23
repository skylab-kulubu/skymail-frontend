'use client';

import { getSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { hasRole, type Role } from '@/lib/access';
import { refreshRoles } from '@/lib/auth/actions';
import { createRoleSync, sameRoles, type RoleSync } from '@/lib/auth/role-sync';
import type { PublicConfig } from '@/lib/runtime-config';

export type ConsoleUser = Readonly<{
  name?: string | null;
  email?: string | null;
  /** The Keycloak subject; the API records it as the author of what this person writes. */
  sub?: string | null;
}>;

type ConsoleContextValue = Readonly<{
  roles: readonly string[];
  user: ConsoleUser;
  config: PublicConfig;
  /**
   * Refreshes the token now and resolves to the roles held afterwards; at most
   * once a minute (role-sync.ts). RoleGate asks before it says no.
   */
  confirmRoles: () => Promise<readonly string[]>;
}>;

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

/** The session's roles as /api/auth/session gives them; null without a usable session. */
async function sessionRoles(): Promise<readonly string[] | null> {
  const session = await getSession();
  return session && !session.error && Array.isArray(session.roles) ? session.roles : null;
}

/**
 * Keeps `rendered` (the roles the server rendered with) in step with the
 * session: checked when the tab is shown again and on every move to another
 * page (role-sync.ts). A change is shown at once and the server parts are
 * rendered again (router.refresh), e.g. the layout's "Erişimin yok" screen.
 */
export function useLiveRoles(rendered: readonly string[]): readonly [readonly string[], RoleSync] {
  const router = useRouter();
  const pathname = usePathname();
  const [roles, setRoles] = useState(rendered);
  const [renderedBefore, setRenderedBefore] = useState(rendered);
  // A new server render (router.refresh, a reload of the layout) brings the roles it read.
  if (!sameRoles(renderedBefore, rendered)) {
    setRenderedBefore(rendered);
    setRoles(rendered);
  }

  const current = useRef(roles);
  useEffect(() => {
    current.current = roles;
  }, [roles]);

  const [sync] = useState(() =>
    createRoleSync({
      current: () => current.current,
      read: sessionRoles,
      refresh: refreshRoles,
      apply: (next) => {
        current.current = next;
        setRoles(next);
        router.refresh();
      },
    }),
  );

  useEffect(() => {
    void sync.check();
  }, [sync, pathname]);

  useEffect(() => {
    const shown = () => {
      if (document.visibilityState !== 'hidden') void sync.check();
    };
    window.addEventListener('focus', shown);
    document.addEventListener('visibilitychange', shown);
    return () => {
      window.removeEventListener('focus', shown);
      document.removeEventListener('visibilitychange', shown);
    };
  }, [sync]);

  return [roles, sync] as const;
}

/** The signed-in person, their roles (kept current, see useLiveRoles) and the runtime config. */
export function ConsoleProvider({
  children,
  roles: rendered,
  user,
  config,
}: Omit<ConsoleContextValue, 'confirmRoles'> & { children: ReactNode }) {
  const [roles, sync] = useLiveRoles(rendered);
  const value = useMemo(
    () => ({ roles, user, config, confirmRoles: sync.confirm }),
    [roles, user, config, sync],
  );
  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole(): ConsoleContextValue {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error('useConsole must be used inside ConsoleProvider');
  return value;
}

/** Whether the signed-in person holds `role` (and `skymail:access`). */
export function useCan(role: Role): boolean {
  return hasRole(useConsole().roles, role);
}
