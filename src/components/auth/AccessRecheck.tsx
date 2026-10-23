'use client';

import { useEffect } from 'react';
import { useLiveRoles, type RefreshRoles } from '@/components/layout/ConsoleContext';
import { CONFIRM_INTERVAL_MS } from '@/lib/auth/role-sync';

// Across mounts too: the refresh's new cookie renders the layout again.
let confirmedAt = Number.NEGATIVE_INFINITY;

/**
 * Beside "Erişimin yok": skymail:access may have been granted after the token
 * was issued. Has the token refreshed once, then checks again whenever the tab
 * is shown; once the session holds the role, the layout renders the panel
 * (useLiveRoles, router.refresh) without signing out and in.
 */
export function AccessRecheck({ roles, refreshRoles }: { roles: readonly string[]; refreshRoles: RefreshRoles }) {
  const [, sync] = useLiveRoles(roles, refreshRoles);
  useEffect(() => {
    if (Date.now() - confirmedAt < CONFIRM_INTERVAL_MS) return;
    confirmedAt = Date.now();
    void sync.confirm();
  }, [sync]);
  return null;
}
