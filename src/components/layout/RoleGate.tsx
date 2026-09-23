'use client';

import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
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
 */
export function RoleGate({ role, children }: { role?: Role | readonly Role[]; children: ReactNode }) {
  const pathname = usePathname() || '/';
  const { roles } = useConsole();
  const required: readonly Role[] = role === undefined ? requiredRolesFor(pathname) : typeof role === 'string' ? [role] : role;

  if (!hasAnyRole(roles, required)) {
    return (
      <StateCard
        Icon={Lock}
        tone="warning"
        title="Bu sayfayı görme yetkin yok"
        description={`Bu sayfa için ${required.join(' ya da ')} rolü gerekiyor. Erişime ihtiyacın varsa kulüp yönetimine başvur.`}
      />
    );
  }
  return <>{children}</>;
}
