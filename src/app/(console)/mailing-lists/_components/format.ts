const DATE_TIME = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

/** "1 Eylül 2026 13:00" in the viewer's time zone; "—" when there is no valid time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME.format(date);
}
