'use client';

// The sidebar of skylcn-ui's AppShell, laid out like the admin panel's
// (core-frontend AdminSidebar): the brand with the club console switcher, the
// sections, and the signed-in person's menu (account, theme, sign-out).
// SkyMail's menu is flat links gated by role (src/lib/access.ts). An
// approver's Mail onayları carries how many requests wait for them (ticket
// 20): one small request per page load, read again when the viewer changes a
// request.

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  MenuItem,
  MenuLabel,
  MenuLinkItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  SidebarBrand,
  SidebarContent,
  SidebarFooter,
  SidebarItem,
  SidebarUser,
  useSidebar,
  useTheme,
  type ThemePreference,
} from '@skylab-kulubu/skylcn-ui';
import { ChevronRight, ClipboardCheck, FileText, Home, List, LogOut, Palette, Send, UserRound } from 'lucide-react';
import { DeveloperCredit } from '@/components/auth/DeveloperCredit';
import { useConsole } from '@/components/layout/ConsoleContext';
import { isApprover, navLabel, visibleNavigation } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import { signOutOfKeycloak } from '@/lib/auth/actions';
import { displayPersonName } from '@/lib/chrome-role';
import { clubConsoles } from '@/lib/club-consoles';
import { APPROVAL_LIST_PATH, pendingCount } from '@/lib/mail-approvals/approvals';
import { onApprovalsChanged } from '@/lib/mail-approvals/changes';

const NAV_ICON = {
  '/': Home,
  '/templates': FileText,
  '/mailing-lists': List,
  '/mail-tasks': Send,
  '/mail-approvals': ClipboardCheck,
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

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The count after Mail onayları; screen readers hear "(n bekleyen)" with the link's name. */
function PendingBadge({ count }: { count: number }) {
  return (
    <>
      <span aria-hidden>{count}</span>
      <span className="sr-only"> ({count} bekleyen)</span>
    </>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <MenuSub>
      <MenuSubTrigger icon={Palette}>Tema</MenuSubTrigger>
      <MenuSubContent>
        <MenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
          <MenuRadioItem value="dark">Koyu</MenuRadioItem>
          <MenuRadioItem value="light">Açık</MenuRadioItem>
          <MenuRadioItem value="system">Sistem</MenuRadioItem>
        </MenuRadioGroup>
      </MenuSubContent>
    </MenuSub>
  );
}

/** Who built SkyMail, under the person's menu; the icon rail has no room for it. */
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
  const { roles, user, config } = useConsole();
  const items = visibleNavigation(roles);
  const pendingApprovals = usePendingApprovals(isApprover(roles));
  const { collapsed } = useSidebar();
  const fullName = user.name ? displayPersonName(user.name) : 'Kullanıcı';
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <SidebarBrand name="SKY LAB" subtitle="SkyMail" consoles={clubConsoles(config.consoles)} current="mail" />
      <SidebarContent>
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            const waiting = item.href === APPROVAL_LIST_PATH && pendingApprovals ? pendingApprovals : 0;
            return (
              <SidebarItem
                key={item.href}
                href={item.href}
                label={navLabel(item.label, waiting, collapsed)}
                icon={NAV_ICON[item.href as keyof typeof NAV_ICON] ?? ChevronRight}
                active={isActive(pathname, item.href)}
                badge={waiting > 0 ? <PendingBadge count={waiting} /> : undefined}
              />
            );
          })}
        </div>
      </SidebarContent>
      <SidebarFooter>
        {/* The sign-out is a Server Action; the menu item submits this form, as the old button did. */}
        <form ref={signOutForm} action={signOutOfKeycloak} hidden />
        <SidebarUser
          name={fullName}
          email={user.email}
          subtitle={user.email ?? undefined}
          menu={
            <>
              {user.email ? <MenuLabel>{user.email}</MenuLabel> : null}
              <MenuLinkItem href={config.accountUrl} icon={UserRound}>
                Hesap merkezi
              </MenuLinkItem>
              <ThemeMenu />
              <MenuSeparator />
              <MenuItem icon={LogOut} destructive onClick={() => signOutForm.current?.requestSubmit()}>
                Çıkış yap
              </MenuItem>
            </>
          }
        />
        <SidebarCredit />
      </SidebarFooter>
    </>
  );
}
