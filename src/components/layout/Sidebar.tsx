'use client';

// Copied from superadmin (ADR-0017). SkyMail's menu is flat links gated by
// role (src/lib/access.ts), so the nav groups, the command palette hooks and
// the club role label are gone; the theme toggle and the brand row are new.
// An approver's Mail onayları carries how many requests wait for them
// (ticket 20): one small request per page load, read again when the viewer
// changes a request.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef } from 'react';
import {
  ChevronRight,
  ClipboardCheck,
  FileText,
  Home,
  List,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/chrome/Avatar';
import { BrandMark } from '@/components/layout/BrandMark';
import { ClubSwitcher } from '@/components/layout/ClubSwitcher';
import { useConsole } from '@/components/layout/ConsoleContext';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { isApprover, visibleNavigation, type NavItem as NavLink } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import { signOutOfKeycloak } from '@/lib/auth/actions';
import { APPROVAL_LIST_PATH, pendingCount } from '@/lib/mail-approvals/approvals';
import { onApprovalsChanged } from '@/lib/mail-approvals/changes';
import { displayPersonName } from '@/lib/chrome-role';
import { isTopModalLayer, registerModalLayer } from '@/lib/ui/modal-layer';

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

type SidebarProps = Readonly<{
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  isDesktopCollapsed?: boolean;
  onDesktopCollapsedChange?: (collapsed: boolean) => void;
}>;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  item,
  pathname,
  onClick,
  collapsed = false,
  badge = null,
}: {
  item: NavLink;
  pathname: string;
  onClick?: () => void;
  collapsed?: boolean;
  /** How many wait there; nothing is shown for none. */
  badge?: number | null;
}) {
  const Icon = NAV_ICON[item.href as keyof typeof NAV_ICON] ?? ChevronRight;
  const active = isActive(pathname, item.href);
  const waiting = badge !== null && badge > 0 ? `${badge} bekleyen` : null;
  const name = waiting ? `${item.label} (${waiting})` : item.label;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed || waiting ? name : undefined}
      title={collapsed ? name : undefined}
      className={`focus-visible:ring-skylab-400/40 group flex min-h-10 items-center rounded-md py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        collapsed ? 'justify-center px-1' : 'gap-3 px-3'
      } ${
        active
          ? 'bg-skylab-500/10 text-skylab-300'
          : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
      }`}
    >
      <span className="relative shrink-0">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
        {collapsed && waiting ? <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-400" aria-hidden /> : null}
      </span>
      {collapsed ? null : <span className="truncate font-medium">{item.label}</span>}
      {!collapsed && waiting ? (
        <span
          className="text-2xs ml-auto rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-px font-medium text-amber-300 tabular-nums"
          aria-hidden
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarContent({
  onItemClick,
  collapsed = false,
  onCollapsedChange,
  pendingApprovals = null,
}: {
  onItemClick?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  pendingApprovals?: number | null;
}) {
  const pathname = usePathname() || '/';
  const { roles, user, config } = useConsole();
  const items = visibleNavigation(roles);
  const fullName = user.name ? displayPersonName(user.name) : 'Kullanıcı';
  const subtitle = user.email?.trim() || '--';

  return (
    <div className={`flex h-full w-full flex-col py-5 ${collapsed ? 'gap-3 px-2' : 'gap-4 px-4'}`}>
      <Link
        href="/"
        onClick={onItemClick}
        className={`flex items-center rounded-md py-1 text-neutral-100 ${collapsed ? 'justify-center' : 'gap-2.5 px-2'}`}
        aria-label="SkyMail ana sayfa"
      >
        <BrandMark size={28} />
        {collapsed ? null : <span className="text-base font-bold tracking-tight">SkyMail</span>}
      </Link>

      <nav aria-label="Ana navigasyon" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            pathname={pathname}
            onClick={onItemClick}
            collapsed={collapsed}
            badge={item.href === APPROVAL_LIST_PATH ? pendingApprovals : null}
          />
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-white/5 pt-3">
        <div
          className={`flex items-center ${collapsed ? 'flex-col justify-center gap-1' : 'gap-3 px-2'}`}
          title={collapsed ? fullName : undefined}
        >
          <Avatar name={fullName} email={user.email ?? ''} size={collapsed ? 'md' : 'lg'} />
          {collapsed ? null : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-100">{fullName}</p>
              <p className="truncate text-xs text-neutral-500">{subtitle}</p>
            </div>
          )}
          <form action={signOutOfKeycloak} className={collapsed ? '' : 'ml-auto'}>
            <button
              type="submit"
              aria-label="Çıkış yap"
              title="Çıkış yap"
              className="hover:text-skylab-300 rounded-lg bg-transparent p-2 text-neutral-500 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
        <ClubSwitcher consoles={config.consoles} collapsed={collapsed} />
        <ThemeToggle collapsed={collapsed} />
        {onCollapsedChange ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            className={`focus-visible:ring-skylab-400/40 flex min-h-9 w-full items-center rounded-md py-2 text-sm text-neutral-500 hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none ${
              collapsed ? 'justify-center px-1' : 'gap-3 px-2'
            }`}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {collapsed ? null : <span>Menüyü daralt</span>}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Sidebar({
  isMobileOpen = false,
  onMobileClose,
  isDesktopCollapsed = false,
  onDesktopCollapsedChange,
}: SidebarProps) {
  const mobileDialogRef = useRef<HTMLElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onMobileCloseRef = useRef(onMobileClose);
  const mobileLayerId = useId();
  const pendingApprovals = usePendingApprovals(isApprover(useConsole().roles));

  useEffect(() => {
    onMobileCloseRef.current = onMobileClose;
  }, [onMobileClose]);

  useEffect(() => {
    if (!isMobileOpen) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unregisterLayer = registerModalLayer(mobileLayerId);
    mobileCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isTopModalLayer(mobileLayerId)) return;
        event.preventDefault();
        onMobileCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        mobileDialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unregisterLayer();
      returnFocusRef.current?.focus();
    };
  }, [isMobileOpen, mobileLayerId]);

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 hidden bg-neutral-950 text-neutral-200 transition-[width] duration-200 md:flex ${
          isDesktopCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent
          collapsed={isDesktopCollapsed}
          onCollapsedChange={onDesktopCollapsedChange}
          pendingApprovals={pendingApprovals}
        />
      </aside>
      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Menü dışını kapat"
            onClick={() => onMobileClose?.()}
          />
          <aside
            ref={mobileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Ana menü"
            className="absolute inset-y-0 left-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-neutral-800 bg-neutral-950 shadow-xl"
          >
            <button
              ref={mobileCloseRef}
              type="button"
              aria-label="Menüyü kapat"
              onClick={() => onMobileClose?.()}
              className="focus-visible:ring-skylab-400/40 mt-3 mr-4 -mb-3 self-end rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onItemClick={() => onMobileClose?.()} pendingApprovals={pendingApprovals} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
