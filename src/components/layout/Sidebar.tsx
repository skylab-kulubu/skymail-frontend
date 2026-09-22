'use client';

// Copied from superadmin (ADR-0017). SkyMail's menu is four flat links gated
// by role (src/lib/access.ts), so the nav groups, the command palette hooks and
// the club role label are gone; the theme toggle and the brand row are new.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef } from 'react';
import {
  ChevronRight,
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
import { visibleNavigation, type NavItem as NavLink } from '@/lib/access';
import { signOutOfKeycloak } from '@/lib/auth/actions';
import { displayPersonName } from '@/lib/chrome-role';
import { isTopModalLayer, registerModalLayer } from '@/lib/ui/modal-layer';

const NAV_ICON = {
  '/': Home,
  '/templates': FileText,
  '/mailing-lists': List,
  '/mail-tasks': Send,
} as const;

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
}: {
  item: NavLink;
  pathname: string;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  const Icon = NAV_ICON[item.href as keyof typeof NAV_ICON] ?? ChevronRight;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`focus-visible:ring-skylab-400/40 group flex min-h-10 items-center rounded-md py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        collapsed ? 'justify-center px-1' : 'gap-3 px-3'
      } ${
        active
          ? 'bg-skylab-500/10 text-skylab-300'
          : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      {collapsed ? null : <span className="truncate font-medium">{item.label}</span>}
    </Link>
  );
}

function SidebarContent({
  onItemClick,
  collapsed = false,
  onCollapsedChange,
}: {
  onItemClick?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
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
            <SidebarContent onItemClick={() => onMobileClose?.()} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
