// Copied from superadmin (ADR-0017); the labels are SkyMail's sections, from
// the one list the menu uses.
import { NAVIGATION } from '@/lib/access';

export const CHROME_CRUMB_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  NAVIGATION.map((item) => [item.href, item.label]),
);

export type ChromeCrumb = Readonly<{ href: string; label: string }>;

function formatSegment(part: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(part) || /^[0-9a-f-]{8,}$/i.test(part)) {
    return 'Kayıt';
  }
  if (/^\d+$/.test(part)) return 'Kayıt';
  const known: Record<string, string> = {
    create: 'Yeni',
    edit: 'Düzenle',
    show: 'Detay',
  };
  if (known[part]) return known[part];
  return part.replace(/[-_]/g, ' ').replace(/^\S/u, (ch) => ch.toLocaleUpperCase('tr-TR'));
}

export function chromeCrumbs(pathname: string): ChromeCrumb[] {
  const parts = (pathname || '/').split('/').filter(Boolean);
  if (parts.length === 0) return [{ href: '/', label: CHROME_CRUMB_LABELS['/'] }];
  const crumbs: ChromeCrumb[] = [];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({
      href: acc,
      label: CHROME_CRUMB_LABELS[acc] ?? formatSegment(part),
    });
  }
  return crumbs;
}
