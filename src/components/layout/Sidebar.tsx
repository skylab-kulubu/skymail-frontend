'use client';

// The sidebar of skylcn-ui's AppShell, laid out like the admin panel's
// (core-frontend AdminSidebar): the brand with the club console switcher and
// the sections. The signed-in person's menu sits at the top right
// (UserMenu, ConsoleShell), never at the foot of the sidebar.
// SkyNotify's menu is flat links gated by role (src/lib/access.ts). An
// approver's Mail onayları carries how many requests wait for them (ticket
// 20): one small request per page load, read again when the viewer changes a
// request.

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarBrand, SidebarContent, SidebarFooter, SidebarItem, useSidebar } from '@skylab-kulubu/skylcn-ui';
import { Ban, ChevronRight, ClipboardCheck, FileText, Home, List, Send, SquarePen } from 'lucide-react';
import { DeveloperCredit } from '@/components/auth/DeveloperCredit';
import { useConsole } from '@/components/layout/ConsoleContext';
import { activeNavHref, isApprover, visibleNavigation } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import { clubConsoles } from '@/lib/club-consoles';
import { TEAM_SEAT_SEND_LABEL, TEAM_SEAT_SEND_PATH } from '@/lib/chrome-breadcrumbs';
import { APPROVAL_LIST_PATH, pendingCount } from '@/lib/mail-approvals/approvals';
import { onApprovalsChanged } from '@/lib/mail-approvals/changes';

const NAV_ICON = {
  '/': Home,
  '/mail-tasks/create': SquarePen,
  '/templates': FileText,
  '/mailing-lists': List,
  '/mail-tasks': Send,
  '/mail-approvals': ClipboardCheck,
  '/suppressions': Ban,
} as const;

/** How many requests wait for an approver; null for anyone else, or while it is not known. */
function usePendingApprovals(approver: boolean): number | null {
  const count = useApiLoad(
    (api, signal) => (approver ? pendingCount(api, signal) : Promise.resolve(null)),
    approver ? 'pending-approvals' : 'none',
  );
  const { reload } = count;
  useEffect(() => (approver ? onApprovalsChanged(() => void reload()) : undefined), [approver, reload]);
  return count.status === 'success' ? count.data : null;
}

/**
 * The count after Mail onayları; screen readers hear "(n bekleyen)" with the
 * link's name. On the icon rail skylcn (0.2) keeps the label and the badge in
 * the link, faded out, and shows a dot: the name still carries the count.
 */
function PendingBadge({ count }: { count: number }) {
  return (
    <>
      <span aria-hidden>{count}</span>
      <span className="sr-only"> ({count} bekleyen)</span>
    </>
  );
}

/** Who built SkyNotify, at the foot of the sidebar; the icon rail has no room for it. */
function SidebarCredit() {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <p className="px-2">
      <DeveloperCredit />
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname() || '/';
  const { roles, config, teamSeat } = useConsole();
  // A Leader without skynotify:access: the send form is "Ekibime gönder", their Teams only.
  const items = visibleNavigation(roles, { teamSeat: teamSeat !== null }).map((item) =>
    teamSeat !== null && item.href === TEAM_SEAT_SEND_PATH ? { ...item, label: TEAM_SEAT_SEND_LABEL } : item,
  );
  const activeHref = activeNavHref(pathname, items);
  const pendingApprovals = usePendingApprovals(isApprover(roles));

  return (
    <>
      <SidebarBrand name="SKY LAB" subtitle="SkyNotify" consoles={clubConsoles(config.consoles)} current="mail" />
      <SidebarContent>
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            const waiting = item.href === APPROVAL_LIST_PATH && pendingApprovals ? pendingApprovals : 0;
            return (
              <SidebarItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={NAV_ICON[item.href as keyof typeof NAV_ICON] ?? ChevronRight}
                active={item.href === activeHref}
                badge={waiting > 0 ? <PendingBadge count={waiting} /> : undefined}
              />
            );
          })}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <SidebarCredit />
      </SidebarFooter>
    </>
  );
}
