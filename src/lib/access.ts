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
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export type NavItem = Readonly<{
  href: string;
  label: string;
  /** The role that opens this section; the home screen needs only access. */
  requires?: Role;
}>;

/**
 * Today's addresses: superadmin links to `/mailing-lists/show/:id` and
 * `/mail-tasks/create`; the approval mails to `/mail-approvals/show/:id`.
 * The mail approvals need nothing beyond access: anyone may submit, and the
 * API lists each viewer what they may see — an approver everyone's, anyone
 * else their own.
 */
export const NAVIGATION: readonly NavItem[] = [
  { href: "/", label: "Ana sayfa" },
  { href: "/templates", label: "Mail template'ler", requires: ROLE.templatesRead },
  { href: "/mailing-lists", label: "Mail listeleri", requires: ROLE.listsRead },
  { href: "/mail-tasks", label: "Gönderimler", requires: ROLE.mailsRead },
  { href: "/mail-approvals", label: "Mail onayları" },
];

export type SectionHref = "/" | "/templates" | "/mailing-lists" | "/mail-tasks" | "/mail-approvals";

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

export function visibleNavigation(roles: readonly string[]): NavItem[] {
  if (!hasAccess(roles)) return [];
  return NAVIGATION.filter((item) => !item.requires || roles.includes(item.requires));
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
  return section?.requires ? [section.requires] : [];
}
