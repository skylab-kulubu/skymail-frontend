'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { hasRole, type Role } from '@/lib/access';
import type { PublicConfig } from '@/lib/runtime-config';

export type ConsoleUser = Readonly<{ name?: string | null; email?: string | null }>;

type ConsoleContextValue = Readonly<{
  roles: readonly string[];
  user: ConsoleUser;
  config: PublicConfig;
}>;

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

/** What the server knew when it rendered the page: the signed-in person, their roles, the runtime config. */
export function ConsoleProvider({
  children,
  ...value
}: ConsoleContextValue & { children: ReactNode }) {
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
