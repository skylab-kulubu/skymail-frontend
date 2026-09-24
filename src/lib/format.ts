const DATE_TIME = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

/** "1 Eylül 2026 13:00" in the viewer's time zone; "—" when there is no valid time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME.format(date);
}

/** The club's zone: the send and Mail template screens show their times in it. */
export const CLUB_TIME_ZONE = 'Europe/Istanbul';

const CLUB_TIME = new Map<string, Intl.DateTimeFormat>();

function clubTimeFormat(timeZone: string): Intl.DateTimeFormat {
  let format = CLUB_TIME.get(timeZone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat('tr-TR', {
        timeZone,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      // A zone this browser does not know: the club's.
      return clubTimeFormat(CLUB_TIME_ZONE);
    }
    CLUB_TIME.set(timeZone, format);
  }
  return format;
}

/**
 * "23 Eyl 2026 09:00" in the club's zone (Europe/Istanbul) whatever the
 * browser's, so a send or a Mail template version reads the same time on
 * every screen and for every operator; in `timeZone` where one is given (the
 * send summary's own). "—" when there is no valid time.
 */
export function formatClubTime(iso: string | null | undefined, timeZone: string = CLUB_TIME_ZONE): string {
  if (!iso) return '—';
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? '—' : clubTimeFormat(timeZone).format(time);
}
