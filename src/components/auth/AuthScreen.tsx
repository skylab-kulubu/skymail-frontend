import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/layout/BrandMark';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

/** The frame for the screens outside the shell: sign-in and "erişimin yok". */
export function AuthScreen({
  Icon,
  tone = 'brand',
  title,
  children,
}: {
  Icon?: LucideIcon;
  tone?: 'brand' | 'warning';
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 p-4">
      <div className="flex justify-end">
        <div className="w-auto">
          <ThemeToggle />
        </div>
      </div>
      <main className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-sm rounded-xl border border-white/5 bg-neutral-900 p-6 shadow-2xl sm:p-8">
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="text-lg font-bold tracking-tight text-neutral-100">SkyMail</span>
          </div>
          <div className="mt-6 flex items-start gap-3">
            {Icon ? (
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${tone === 'warning' ? 'text-amber-400' : 'text-skylab-300'}`}
                strokeWidth={1.75}
                aria-hidden
              />
            ) : null}
            <h1 className="text-base font-semibold text-neutral-100">{title}</h1>
          </div>
          <div className="mt-3 space-y-4 text-sm leading-relaxed text-neutral-400">{children}</div>
        </div>
      </main>
    </div>
  );
}
