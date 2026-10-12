import { ShieldX } from 'lucide-react';
import { Button } from '@skylab-kulubu/skylcn-ui';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { signOutOfKeycloak } from '@/lib/auth/actions';
import { displayPersonName } from '@/lib/chrome-role';
import { clubConsoles } from '@/lib/club-consoles';
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
  const others = clubConsoles(consoles).filter((app) => app.id !== 'mail');
  return (
    <AuthScreen
      Icon={ShieldX}
      tone="warning"
      title="Erişimin yok"
      description={
        <>
          {person ? <strong className="text-foreground font-medium">{person}</strong> : 'Bu hesapla'}
          {person ? ' olarak giriş yaptın, ama' : ''} SkyMail&apos;i kullanma yetkin yok. Erişime
          ihtiyacın varsa kulüp yönetiminden <code className="text-secondary-foreground font-mono">skymail:access</code>{' '}
          rolünü iste.
        </>
      }
      actions={
        <form action={signOutOfKeycloak} className="w-full">
          <Button type="submit" variant="outline" size="lg" className="w-full">
            Başka bir hesapla giriş yap
          </Button>
        </form>
      }
    >
      <nav aria-label="Diğer konsollar" className="border-border-subtle border-t pt-4">
        <p className="text-3xs tracking-label text-subtle-foreground mb-2 uppercase">Diğer konsollar</p>
        <ul className="flex flex-col gap-1">
          {others.map((app) => {
            const Icon = app.icon;
            return (
              <li key={app.id}>
                <a
                  href={app.href}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex min-h-9 items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors outline-hidden focus-visible:ring-2"
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  {app.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </AuthScreen>
  );
}
