// Copied from superadmin (ADR-0017); the labels are SkyMail's sections, from
// the one list the menu uses. Unlike the copy, a crumb says whether its
// address is a page, so a segment without one is shown as text, not a link
// to a 404.
import { NAVIGATION } from '@/lib/access';

export const CHROME_CRUMB_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  NAVIGATION.map((item) => [item.href, item.label]),
);

export type ChromeCrumb = Readonly<{
  href: string;
  label: string;
  /** Whether `href` is a page of its own; if not, the crumb is plain text. */
  isPage: boolean;
}>;

function formatSegment(part: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(part) || /^[0-9a-f-]{8,}$/i.test(part)) {
    return 'Kayıt';
  }
  if (/^\d+$/.test(part)) return 'Kayıt';
  const known: Record<string, string> = {
    create: 'Yeni',
    edit: 'Düzenle',
    show: 'Detay',
    history: 'Sürüm geçmişi',
  };
  if (known[part]) return known[part];
  return part.replace(/[-_]/g, ' ').replace(/^\S/u, (ch) => ch.toLocaleUpperCase('tr-TR'));
}

/**
 * The address contract: a section (`/mailing-lists`) and, under it,
 * `create`, `edit/:id` and `show/:id` — and a Mail template's
 * `history/:id`. `show` or `edit` alone, or an id alone, has no page.
 */
function isPage(parts: readonly string[]): boolean {
  if (!(`/${parts[0]}` in CHROME_CRUMB_LABELS)) return false;
  if (parts.length === 1) return true;
  if (parts.length === 2) return parts[1] === 'create';
  if (parts.length === 3) return parts[1] === 'edit' || parts[1] === 'show' || parts[1] === 'history';
  return false;
}

export function chromeCrumbs(pathname: string): ChromeCrumb[] {
  const parts = (pathname || '/').split('/').filter(Boolean);
  if (parts.length === 0) return [{ href: '/', label: CHROME_CRUMB_LABELS['/'], isPage: true }];
  return parts.map((part, index) => {
    const href = `/${parts.slice(0, index + 1).join('/')}`;
    return {
      href,
      label: CHROME_CRUMB_LABELS[href] ?? formatSegment(part),
      isPage: isPage(parts.slice(0, index + 1)),
    };
  });
}

/** Where the phone's back link goes: the nearest page above the current one, if any. */
export function backCrumb(crumbs: readonly ChromeCrumb[]): ChromeCrumb | null {
  return crumbs.slice(0, -1).findLast((crumb) => crumb.isPage) ?? null;
}
