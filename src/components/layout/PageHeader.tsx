'use client';

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={`border-b border-white/5 pb-4 ${className ?? ''}`}>
      <div
        className={`flex items-start gap-3 ${actions ? 'sm:items-center sm:justify-between' : ''}`}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-lg font-medium text-neutral-100">{title}</h1>
          {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
          {meta ? <div className="flex flex-wrap items-center gap-1.5 pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
