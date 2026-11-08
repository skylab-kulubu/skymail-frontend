/**
 * The `skymail` client roles and what each one opens in the panel.
 *
 * Keycloak names them with the client prefix — `skymail:templates:read`, not
 * `templates:read` — and skymail-backend checks exactly these strings.
 * `skymail:access` is the gate: without it nothing else counts.
 */

export const ROLE = {
  access: "skymail:access",
  templatesRead: "skymail:templates:read",
  templatesWrite: "skymail:templates:write",
  listsRead: "skymail:lists:read",
  listsWrite: "skymail:lists:write",
  mailsRead: "skymail:mails:read",
  mailsWrite: "skymail:mails:write",
  mailsSend: "skymail:mails:send",
  /** Mail onayı (ticket 18): decides sends submitted for approval; apart from sending. */
  mailsApprove: "skymail:mails:approve",
  /** A tracked send's recipients one by one (hub ticket 15b; YK, DK, ADMIN). A send's own sender needs no role for its own. */
  mailsTrackingRead: "skymail:mails:tracking:read",
  /** Reverses an address's unsubscribe at the person's request, with a reason (abonelik-cikisi 04, Keycloak ticket 10). */
  unsubscribesReactivate: "skymail:unsubscribes:reactivate",
  /** Removes a bounce from the suppression list and reads the bounce rate (skymail-bounce-isleme 08, Keycloak ticket 06). */
  suppressionsManage: "skymail:suppressions:manage",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export type NavItem = Readonly<{
  href: string;
  label: string;
  /** The role that opens this section, or the roles any one of which does; the home screen needs only access. */
  requires?: Role | readonly Role[];
}>;

/**
 * Today's addresses: superadmin links to `/mailing-lists/show/:id` and
 * `/mail-tasks/create`; the approval mails to `/mail-approvals/show/:id`.
 * The mail approvals need nothing beyond access: anyone may submit, and the
 * API lists each viewer what they may see — an approver everyone's, anyone
 * else their own. Yeni gönderim is the send form, for whoever may compose
 * one (`templates:read`, send-form/access.ts): a team leader holds only that
 * and access, and has no send list to reach it from.
 */
export const NAVIGATION: readonly NavItem[] = [
  { href: "/", label: "Ana sayfa" },
  { href: "/mail-tasks/create", label: "Yeni gönderim", requires: ROLE.templatesRead },
  { href: "/templates", label: "Mail template'ler", requires: ROLE.templatesRead },
  { href: "/mailing-lists", label: "Mail listeleri", requires: ROLE.listsRead },
  { href: "/mail-tasks", label: "Gönderimler", requires: ROLE.mailsRead },
  { href: "/mail-approvals", label: "Mail onayları" },
  { href: "/suppressions", label: "Bastırma listesi", requires: [ROLE.suppressionsManage, ROLE.unsubscribesReactivate] },
];

export type SectionHref = "/" | "/mail-tasks/create" | "/templates" | "/mailing-lists" | "/mail-tasks" | "/mail-approvals" | "/suppressions";

/** A section's label, for the menu, the breadcrumbs, the tab title and the page header. */
export function sectionLabel(href: SectionHref): string {
  const section = NAVIGATION.find((item) => item.href === href);
  if (!section) throw new Error(`no section at ${href}`);
  return section.label;
}

export function hasAccess(roles: readonly string[]): boolean {
  return roles.includes(ROLE.access);
}

export function hasRole(roles: readonly string[], role: Role): boolean {
  return hasAccess(roles) && roles.includes(role);
}

/** The roles any one of which opens a section; none beyond access when it names none. */
function sectionRoles(item: NavItem): readonly Role[] {
  if (!item.requires) return [];
  return typeof item.requires === "string" ? [item.requires] : item.requires;
}

export function visibleNavigation(roles: readonly string[]): NavItem[] {
  if (!hasAccess(roles)) return [];
  return NAVIGATION.filter((item) => hasAnyRole(roles, sectionRoles(item)));
}

/**
 * The menu item the address sits under: the most specific one, so the send
 * form lights Yeni gönderim rather than Gönderimler as well. The home screen
 * only at `/`; none for an address no item covers.
 */
export function activeNavHref(pathname: string, items: readonly NavItem[]): string | null {
  let active: string | null = null;
  for (const { href } of items) {
    const under = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    if (under && (active === null || href.length > active.length)) active = href;
  }
  return active;
}

/**
 * What the home screen shows: the send summary to one who reads the send
 * list (`mails:read`); to one who may compose a send but not read the list —
 * a team leader — a way to a new send and their own requests; and that there
 * is nothing here only to one who can do neither.
 */
export function homeView(roles: readonly string[]): "summary" | "composer" | "none" {
  if (hasRole(roles, ROLE.mailsRead)) return "summary";
  return hasRole(roles, ROLE.templatesRead) ? "composer" : "none";
}

/**
 * The home screen once the token's roles are known: `homeView`, except that
 * one who can do neither waits for the token to be refreshed once (a role
 * may have been granted after it was issued) before the lock shows; and an
 * approver's lock leads to the mail approvals, which they can decide.
 */
export function homeScreen(
  roles: readonly string[],
  { confirmed }: { confirmed: boolean },
): "summary" | "composer" | "checking" | "locked" | "lockedApprover" {
  const view = homeView(roles);
  if (view !== "none") return view;
  if (!confirmed) return "checking";
  return isApprover(roles) ? "lockedApprover" : "locked";
}

/** Whether the viewer decides sends submitted for approval (Mail onayı). */
export function isApprover(roles: readonly string[]): boolean {
  return hasRole(roles, ROLE.mailsApprove);
}

/** Whether `roles` hold any one of `anyOf` (and `skymail:access`); none asked for is only access. */
export function hasAnyRole(roles: readonly string[], anyOf: readonly Role[]): boolean {
  return hasAccess(roles) && (anyOf.length === 0 || anyOf.some((role) => roles.includes(role)));
}

/**
 * Pages whose roles are not their section's read role. The send form
 * (`/mail-tasks/create`, ticket 16) sends what the viewer may send and
 * submits the rest for approval (ticket 20), so it needs only access; a
 * sender need not read the send list. It asks for `templates:read` itself,
 * to offer a template.
 */
const PAGE_ROLES: ReadonlyArray<Readonly<{ path: string; anyOf: readonly Role[] }>> = [{ path: "/mail-tasks/create", anyOf: [] }];

/**
 * The roles a page needs, any one of them: its own, or the read role of the
 * section its address sits under; none beyond access for the home screen.
 */
export function requiredRolesFor(pathname: string): readonly Role[] {
  const page = PAGE_ROLES.find((entry) => entry.path === pathname);
  if (page) return page.anyOf;
  const section = NAVIGATION.find(
    (item) => item.href !== "/" && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
  return section ? sectionRoles(section) : [];
}

/**
 * A section's name in the menu. On the icon rail skylcn draws no badge, only
 * a dot, and names the link (and its tooltip) by the label alone, so there
 * the label itself says how many wait.
 */
export function navLabel(label: string, waiting: number, collapsed: boolean): string {
  return collapsed && waiting > 0 ? `${label} (${waiting} bekleyen)` : label;
}
