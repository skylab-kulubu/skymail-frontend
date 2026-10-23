'use client';

import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { StateCard } from '@skylab-kulubu/skylcn-ui';
import { useConsole } from '@/components/layout/ConsoleContext';
import { hasAnyRole, requiredRolesFor, type Role } from '@/lib/access';

/**
 * A page opened by its address — a bookmark, a link from superadmin — that
 * this person may not use. Say so instead of letting the page's first request,
 * or its save, come back 403.
 *
 * Without `role` it guards a page by what its address needs (access.ts
 * requiredRolesFor: its section's read role, or the page's own roles; the
 * shell wraps every page in one). A page that changes things wraps itself in
 * another with its write role, e.g. `<RoleGate role={ROLE.listsWrite}>`.
 * Given several roles, any one of them opens the page.
 *
 * Before saying no it has the token refreshed once (ConsoleContext
 * confirmRoles): the role may have been granted after the token was issued.
 * Nothing shows meanwhile; the answer then opens the page or says no.
 */
export function RoleGate({ role, children }: { role?: Role | readonly Role[]; children: ReactNode }) {
  const pathname = usePathname() || '/';
  const { roles, confirmRoles } = useConsole();
  const required: readonly Role[] = role === undefined ? requiredRolesFor(pathname) : typeof role === 'string' ? [role] : role;
  const allowed = hasAnyRole(roles, required);
  // The page and roles a fresh token has already said no to.
  const asked = `${pathname} ${required.join(' ')}`;
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    if (allowed || confirmed === asked) return;
    let current = true;
    void confirmRoles().then(() => {
      if (current) setConfirmed(asked);
    });
    return () => {
      current = false;
    };
  }, [allowed, asked, confirmed, confirmRoles]);

  if (!allowed) {
    if (confirmed !== asked) return null;
    return (
      <StateCard
        icon={Lock}
        tone="warning"
        title="Bu sayfayı görme yetkin yok"
        description={`Bu sayfa için ${required.join(' ya da ')} rolü gerekiyor. Erişime ihtiyacın varsa kulüp yönetimine başvur.`}
      />
    );
  }
  return <>{children}</>;
}
