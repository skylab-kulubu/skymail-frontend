import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { ConsoleShell } from '@/components/layout/ConsoleShell';
import { hasAccess } from '@/lib/access';
import { publicConfig } from '@/lib/runtime-config';

// Every render reads the session and the runtime environment.
//
// Being dynamic, a page may read useSearchParams() without a <Suspense>
// around it, and a page must not add one around its client component. The
// server streams such a boundary after the shell, and React reveals and
// hydrates it from requestAnimationFrame. A tab that draws no frames (opened
// in the background, a covered window, a browser an agent drives) would then
// never run the page's effects, and its data would never load (ticket 24,
// tests/e2e/direct-load.spec.ts).
export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  // proxy.ts already sends these to /login; this keeps the layout safe on its own.
  if (!session || session.error) redirect('/login');

  const config = publicConfig();
  if (!hasAccess(session.roles)) {
    return <AccessDenied name={session.user?.name} consoles={config.consoles} />;
  }

  return (
    <ConsoleShell
      roles={session.roles}
      user={{ name: session.user?.name, email: session.user?.email, sub: session.subject }}
      config={config}
    >
      {children}
    </ConsoleShell>
  );
}
