'use client';

import { Button, Notice } from '@skylab-kulubu/skylcn-ui';
import type { NoticeData } from '@/lib/notice';

/** skylcn-ui's Notice tone for SkyMail's: an error is skylcn's danger (announced at once, `alert`). */
export function noticeTone(tone: NoticeData['tone'] | 'info'): 'success' | 'warning' | 'danger' | 'info' {
  return tone === 'error' ? 'danger' : tone;
}

/**
 * The outcome of an action, said in words: a success as a success, an error
 * as the API's Turkish sentence. A notice that reports an archive offers
 * "Geri al" when the page passes `onRestore`.
 */
export function OutcomeNotice({
  notice,
  onDismiss,
  onRestore,
  restoring = false,
}: {
  notice: NoticeData;
  onDismiss?: () => void;
  onRestore?: (record: { id: string; name: string }) => void;
  restoring?: boolean;
}) {
  const restore = notice.restore;
  return (
    <Notice
      tone={noticeTone(notice.tone)}
      onDismiss={onDismiss}
      dismissLabel="Bildirimi kapat"
      action={
        restore && onRestore ? (
          <Button variant="link" size="sm" pending={restoring} onClick={() => onRestore(restore)}>
            {restoring ? 'Geri alınıyor…' : 'Geri al'}
          </Button>
        ) : undefined
      }
    >
      {notice.text}
    </Notice>
  );
}
