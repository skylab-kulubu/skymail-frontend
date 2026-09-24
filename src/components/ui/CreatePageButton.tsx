'use client';

// Copied from superadmin (ADR-0017).

import { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';

function PlusIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

/** Liste sayfalarında “Yeni …” üst aksiyonu — dolu primary, artı ikon. */
export function CreatePageButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button href={href} className="inline-flex items-center gap-2">
      <PlusIcon />
      {children}
    </Button>
  );
}
