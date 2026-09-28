'use client';

// While SkyMail runs with MAIL_SENDER=paused, as during a restore from backup
// (skymail-backend ticket 28), a send is queued and never goes out. The home
// screen and the send list say so above everything else, with no way to close
// it: the notice lasts as long as the pause.

import { NoticeBox } from '@/components/chrome/Notice';
import { useApiLoad } from '@/lib/api/react';
import { fetchSenderPaused, SENDER_PAUSED_TEXT } from '@/lib/sends';

export function SenderPausedNotice() {
  return <NoticeBox tone="warning">{SENDER_PAUSED_TEXT}</NoticeBox>;
}

/**
 * For a screen with no summary of its own: asks the summary whether the
 * sender is paused. An answer that does not come says nothing; the screen's
 * own request reports what went wrong.
 */
export function SenderPausedCheck() {
  const state = useApiLoad((api, signal) => fetchSenderPaused(api, signal), 'sender-paused');
  return state.status === 'success' && state.data ? <SenderPausedNotice /> : null;
}
