// Copied from superadmin (ADR-0017); a spinner stands in for SkylabLoader, and
// without 'use client' it renders in server pages too (it takes an icon
// component, which cannot cross into a client component as a prop).
import { Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const TONE_ICON = {
  neutral: 'text-neutral-200',
  danger: 'text-red-400',
  warning: 'text-amber-400',
  brand: 'text-skylab-300',
} as const;

export function StateCard({
  title,
  description,
  Icon,
  isLoading,
  tone = 'neutral',
  children,
}: {
  title: string;
  description?: string;
  Icon?: LucideIcon;
  isLoading?: boolean;
  tone?: keyof typeof TONE_ICON;
  children?: ReactNode;
}) {
  const iconColor = TONE_ICON[tone];
  return (
    <div
      className="flex w-full flex-1 items-center justify-center px-6 py-10"
      role={isLoading ? 'status' : undefined}
      aria-live={isLoading ? 'polite' : undefined}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        {isLoading ? (
          <Loader2 className="text-skylab-300 h-8 w-8 animate-spin" strokeWidth={1.75} aria-hidden />
        ) : Icon ? (
          <Icon
            className={`h-9 w-9 ${iconColor} drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]`}
            strokeWidth={1.75}
          />
        ) : null}
        <div
          className={
            isLoading
              ? 'mt-5 flex flex-col gap-2 text-balance'
              : 'mt-4 flex flex-col gap-2 text-balance'
          }
        >
          <p className="text-sm font-semibold text-neutral-100">{title}</p>
          {description ? (
            <p className="text-xs leading-relaxed text-neutral-400">{description}</p>
          ) : null}
        </div>
        {children ? <div className="mt-5 w-full">{children}</div> : null}
      </div>
    </div>
  );
}
