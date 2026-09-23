import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { ConsoleShell } from '@/components/layout/ConsoleShell';
import { hasAccess } from '@/lib/access';
import { tokenSubject } from '@/lib/auth/session-token';
import { publicConfig } from '@/lib/runtime-config';

// Every render reads the session and the runtime environment.
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
      user={{ name: session.user?.name, email: session.user?.email, sub: tokenSubject(session.accessToken) }}
      config={config}
    >
      {children}
    </ConsoleShell>
  );
}
