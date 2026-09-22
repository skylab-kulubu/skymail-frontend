'use client';

import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { useConsole } from '@/components/layout/ConsoleContext';
import { hasRole, requiredRoleFor, type Role } from '@/lib/access';

/**
 * A page opened by its address — a bookmark, a link from superadmin — that
 * this person may not use. Say so instead of letting the page's first request,
 * or its save, come back 403.
 *
 * Without `role` it guards a section by the read role the menu uses (the
 * shell wraps every page in one). A page that changes things wraps itself in
 * another with its write role, e.g. `<RoleGate role={ROLE.listsWrite}>`.
 */
export function RoleGate({ role, children }: { role?: Role; children: ReactNode }) {
  const pathname = usePathname() || '/';
  const { roles } = useConsole();
  const required = role ?? requiredRoleFor(pathname);

  if (required && !hasRole(roles, required)) {
    return (
      <StateCard
        Icon={Lock}
        tone="warning"
        title="Bu sayfayı görme yetkin yok"
        description={`Bu ${role ? 'sayfa' : 'bölüm'} için ${required} rolü gerekiyor. Erişime ihtiyacın varsa kulüp yönetimine başvur.`}
      />
    );
  }
  return <>{children}</>;
}
