'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PanelDialog } from '@/components/common/PanelDialog';
import { useApi } from '@/lib/api/react';
import { signInWithKeycloak } from '@/lib/auth/actions';
import { Button } from '@skylab-kulubu/skylcn-ui';

/**
 * Listens for the HTTP client's "session ended" announcement (a 401, or a
 * token Keycloak would not refresh) and offers a re-login that comes back to
 * this page. It can be closed, so someone halfway through a form can copy what
 * they wrote before signing in again.
 */
export function SessionEndedDialog() {
  const api = useApi();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [open, setOpen] = useState(false);

  useEffect(() => api.onSessionEnded(() => setOpen(true)), [api]);

  const callbackUrl = search ? `${pathname}?${search}` : pathname;

  return (
    <PanelDialog isOpen={open} onClose={() => setOpen(false)} title="Oturumun sona erdi">
      <p className="leading-relaxed">
        Oturumun kapandığı için son isteğin tamamlanamadı. Kaldığın yerden devam etmek için yeniden
        giriş yap; bu sayfaya geri dönersin.
      </p>
      <form action={signInWithKeycloak} className="mt-5 flex flex-wrap justify-end gap-2">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button variant="outline" onClick={() => setOpen(false)}>
          Kapat
        </Button>
        <Button variant="primary" type="submit">Yeniden giriş yap</Button>
      </form>
    </PanelDialog>
  );
}
