'use client';

// The bar under a form page: İptal on the left, Kaydet on the right.

import { ReactNode } from 'react';

interface FormActionsProps {
  /** Genelde “İptal” — solda */
  cancel: ReactNode;
  /** Genelde “Kaydet” / “Güncelle” — sağda */
  submit: ReactNode;
  className?: string;
}

const BAR = 'border-border-subtle mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5';

/** Form sayfalarında tutarlı alt aksiyon çubuğu: iptal solda, kaydet sağda. */
export function FormActions({ cancel, submit, className }: FormActionsProps) {
  return (
    <div className={className ? `${BAR} ${className}` : BAR}>
      {cancel}
      {submit}
    </div>
  );
}
