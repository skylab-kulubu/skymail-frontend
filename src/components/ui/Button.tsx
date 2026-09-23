'use client';

// Copied from superadmin (ADR-0017).

import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outlineBrand' | 'outlineDanger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

export function Button({
  children,
  onClick,
  href,
  variant = 'primary',
  type = 'button',
  disabled,
  className,
  title,
  'aria-label': ariaLabel,
}: ButtonProps) {
  const router = useRouter();

  const baseClasses =
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skylab-400/40 disabled:opacity-50 disabled:cursor-not-allowed';
  // superadmin's copy referenced tailwind.config colours (brand-600, light-300,
  // dark-200) that Tailwind 4 never loads; these are the chrome's own tokens.
  const variantClasses = {
    primary:
      'border-skylab-400/40 bg-skylab-500/10 text-skylab-300 hover:border-skylab-300/60 hover:bg-skylab-400/20',
    secondary: 'border-white/10 bg-transparent text-neutral-200 hover:border-white/20 hover:bg-white/5',
    danger: 'border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20',
    outlineBrand: 'border-skylab-400/40 bg-transparent text-skylab-300 hover:bg-skylab-500/10',
    outlineDanger: 'border-red-400/40 bg-transparent text-red-300 hover:bg-red-500/10',
  };

  const combinedClassName = className
    ? `${baseClasses} ${variantClasses[variant]} ${className}`
    : `${baseClasses} ${variantClasses[variant]}`;

  if (href) {
    return (
      <button
        type="button"
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) {
            router.push(href);
          }
        }}
        className={combinedClassName}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={combinedClassName}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
