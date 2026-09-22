'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { useCan } from '@/components/layout/ConsoleContext';
import { ROLE } from '@/lib/access';
import { listHref } from '@/lib/mailing-lists';

/**
 * The create and edit pages opened by address — a bookmark, superadmin's
 * "create a list" link — by someone who may read lists but not change them.
 * Say so instead of letting the save come back 403.
 */
export function WriteGate({ children }: { children: ReactNode }) {
  if (useCan(ROLE.listsWrite)) return <>{children}</>;
  return (
    <StateCard
      Icon={Lock}
      tone="warning"
      title="Bu sayfayı görme yetkin yok"
      description={`Mail listesi oluşturmak ve düzenlemek için ${ROLE.listsWrite} rolü gerekiyor. Erişime ihtiyacın varsa kulüp yönetimine başvur.`}
    >
      <Link href={listHref.index} className="text-skylab-300 text-sm hover:underline">
        Mail listelerine dön
      </Link>
    </StateCard>
  );
}
