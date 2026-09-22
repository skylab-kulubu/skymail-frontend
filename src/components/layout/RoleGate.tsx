'use client';

import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { useConsole } from '@/components/layout/ConsoleContext';
import { hasRole, requiredRoleFor } from '@/lib/access';

/**
 * A page opened by its address — a bookmark, a link from superadmin — for a
 * section the menu does not offer this person. Say so instead of letting the
 * page's first request come back 403.
 */
export function RoleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const { roles } = useConsole();
  const required = requiredRoleFor(pathname);

  if (required && !hasRole(roles, required)) {
    return (
      <StateCard
        Icon={Lock}
        tone="warning"
        title="Bu sayfayı görme yetkin yok"
        description={`Bu bölüm için ${required} rolü gerekiyor. Erişime ihtiyacın varsa kulüp yönetimine başvur.`}
      />
    );
  }
  return <>{children}</>;
}
