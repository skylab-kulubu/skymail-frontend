import { ShieldX } from 'lucide-react';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { ClubSwitcher } from '@/components/layout/ClubSwitcher';
import { signOutOfKeycloak } from '@/lib/auth/actions';
import { displayPersonName } from '@/lib/chrome-role';
import type { ConsoleLink } from '@/lib/runtime-config';

/**
 * Someone signed in with SKY LAB but without `skymail:access`. They get a
 * clear answer and what to do about it, rather than a panel whose every
 * request fails.
 */
export function AccessDenied({
  name,
  consoles,
}: {
  name?: string | null;
  consoles: readonly ConsoleLink[];
}) {
  const person = name ? displayPersonName(name) : null;
  return (
    <AuthScreen Icon={ShieldX} tone="warning" title="Erişimin yok">
      <p>
        {person ? <strong className="font-medium text-neutral-200">{person}</strong> : 'Bu hesapla'}
        {person ? ' olarak giriş yaptın, ama' : ''} SkyMail&apos;i kullanma yetkin yok. Erişime
        ihtiyacın varsa kulüp yönetiminden <code className="text-neutral-300">skymail:access</code>{' '}
        rolünü iste.
      </p>
      <form action={signOutOfKeycloak}>
        <Button type="submit" variant="secondary" className="w-full">
          Başka bir hesapla giriş yap
        </Button>
      </form>
      <div className="border-t border-white/5 pt-3">
        <p className="text-2xs mb-1 tracking-wider text-neutral-500 uppercase">Diğer konsollar</p>
        <ClubSwitcher consoles={consoles} />
      </div>
    </AuthScreen>
  );
}
