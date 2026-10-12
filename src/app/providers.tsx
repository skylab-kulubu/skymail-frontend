'use client';

import { SkylcnProvider, TooltipProvider } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** skylcn-ui's labels in Turkish, next/link for its internal links, one tooltip delay for the page. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SkylcnProvider locale="tr" linkComponent={Link}>
      <TooltipProvider>{children}</TooltipProvider>
    </SkylcnProvider>
  );
}
