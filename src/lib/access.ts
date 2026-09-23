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
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export type NavItem = Readonly<{
  href: string;
  label: string;
  /** The role that opens this section; the home screen needs only access. */
  requires?: Role;
}>;

/** Today's addresses: superadmin links to `/mailing-lists/show/:id` and `/mail-tasks/create`. */
export const NAVIGATION: readonly NavItem[] = [
  { href: "/", label: "Ana sayfa" },
  { href: "/templates", label: "Mail template'ler", requires: ROLE.templatesRead },
  { href: "/mailing-lists", label: "Mail listeleri", requires: ROLE.listsRead },
  { href: "/mail-tasks", label: "Gönderimler", requires: ROLE.mailsRead },
];

export type SectionHref = "/" | "/templates" | "/mailing-lists" | "/mail-tasks";

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

/**
 * Pages that decide who may use them themselves, beyond their section's read
 * role: the send form takes `mails:send` or `mails:write`, and a sender need
 * not read the send list (src/lib/send-form/access.ts).
 */
const SELF_GATED: readonly string[] = ["/mail-tasks/create"];

/** The role a page needs, by the section its address sits under. */
export function requiredRoleFor(pathname: string): Role | undefined {
  if (SELF_GATED.includes(pathname)) return undefined;
  const section = NAVIGATION.find(
    (item) => item.href !== "/" && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
  return section?.requires;
}
