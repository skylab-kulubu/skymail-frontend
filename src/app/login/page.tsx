import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { auth } from '@/auth';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
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
    <AuthScreen Icon={LogIn} title="Giriş">
      <p>SkyMail&apos;e SKY LAB hesabınla giriş yaparsın; diğer kulüp konsollarıyla aynı hesap.</p>
      {errorText ? (
        <p role="alert" className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-300">
          {errorText}
        </p>
      ) : null}
      <form action={signInWithKeycloak}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button type="submit" className="w-full">
          SKY LAB ile giriş yap
        </Button>
      </form>
    </AuthScreen>
  );
}
