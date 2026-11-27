import { SkylabMark, TaskPage } from '@skylab-kulubu/skylcn-ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { DeveloperCredit } from '@/components/auth/DeveloperCredit';

/**
 * The frame for the screens outside the shell: sign-in and "erişimin yok".
 * skylcn-ui's TaskPage, with the console's name (SkyNotify) beside the SKY LAB mark and the
 * developer credit under the task.
 */
export function AuthScreen({
  Icon,
  top,
  tone = 'brand',
  title,
  description,
  actions,
  children,
}: {
  Icon?: LucideIcon;
  /** A picture above the title in place of the icon, such as an error scene. */
  top?: ReactNode;
  tone?: 'brand' | 'warning';
  title: string;
  description?: ReactNode;
  /** The task's buttons, under its body. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <TaskPage
      icon={Icon}
      top={top}
      tone={tone}
      title={title}
      description={description}
      actions={actions}
      align="center"
      brand={
        <>
          <SkylabMark size={22} />
          <span className="text-sm font-semibold tracking-tight">SkyNotify</span>
        </>
      }
      footer={<DeveloperCredit />}
    >
      {children}
    </TaskPage>
  );
}
