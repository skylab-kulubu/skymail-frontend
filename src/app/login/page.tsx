import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { auth } from '@/auth';
import { Button, Notice } from '@skylab-kulubu/skylcn-ui';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { signInWithKeycloak } from '@/lib/auth/actions';
import { safeCallbackPath } from '@/lib/auth/redirect';

export const metadata: Metadata = { title: 'Giriş' };

// Auth.js sends its own error codes here (pages.error); the rest are ours.
const ERROR_TEXT: Readonly<Record<string, string>> = {
  SessionExpired: 'Oturumun sona erdi. Kaldığın yerden devam etmek için yeniden giriş yap.',
  Configuration:
    'Giriş şu anda yapılamıyor: sunucu ayarlarında bir sorun var. Sürerse yöneticine haber ver.',
  AccessDenied: 'Giriş reddedildi.',
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(
    Array.isArray(params.callbackUrl) ? params.callbackUrl[0] : params.callbackUrl,
  );
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  const session = await auth();
  if (session && !session.error && !error) redirect(callbackUrl);

  const errorText = error ? (ERROR_TEXT[error] ?? 'Giriş tamamlanamadı. Tekrar dene.') : null;

  return (
    <AuthScreen
      Icon={LogIn}
      title="Giriş"
      description="İletişim konsoluna SKY LAB hesabınla giriş yaparsın; diğer kulüp konsollarıyla aynı hesap."
      actions={
        <form action={signInWithKeycloak} className="w-full">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" variant="solid" size="lg" className="w-full">
            SKY LAB ile giriş yap
          </Button>
        </form>
      }
    >
      {errorText ? (
        <Notice tone="warning" role="alert">
          {errorText}
        </Notice>
      ) : null}
    </AuthScreen>
  );
}
