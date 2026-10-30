'use client';

// A send's controls (hub ticket duyuru-haber 05 G4, 08): pause, resume and
// cancel at the top of its page, and what the page says while it is paused
// or once it was cancelled. A cancel asks first: it cannot be undone.

import { useState } from 'react';
import { Button, ConfirmDialog, Notice } from '@skylab-kulubu/skylcn-ui';
import { useConsole } from '@/components/layout/ConsoleContext';
import { ToneBadge } from '@/components/common/ToneBadge';
import { apiErrorMessage } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import { CONTROL_LABEL, cancelConfirmText, controlNotice, controlSend, sendControls, type SendControl } from '@/lib/send-controls';
import type { Send } from '@/lib/sends';

/** "Duraklatıldı" or "İptal edildi" beside the send's status. */
export function SendControlBadge({ send }: { send: Send }) {
  if (send.cancelled_at) return <ToneBadge tone="idle" label="İptal edildi" />;
  if (send.paused_at) return <ToneBadge tone={send.paused_reason === 'failure_rate' ? 'bad' : 'busy'} label="Duraklatıldı" />;
  return null;
}

export function SendControlNotice({ send }: { send: Send }) {
  const notice = controlNotice(send);
  if (!notice) return null;
  return (
    <Notice tone={notice.tone} title={notice.title}>
      {notice.text}
    </Notice>
  );
}

/** The buttons the viewer may use on the send; nothing when there are none. */
export function SendControls({ send, onChanged }: { send: Send; onChanged: () => Promise<void> }) {
  const api = useApi();
  const { roles, user } = useConsole();
  const [busy, setBusy] = useState<SendControl | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const controls = sendControls(send, { roles, sub: user.sub });
  if (controls.length === 0) return null;

  async function run(control: SendControl) {
    setBusy(control);
    setProblem(null);
    try {
      await controlSend(api, send.id, control);
      await onChanged();
    } catch (error) {
      setProblem(apiErrorMessage(error));
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        {controls.map((control) =>
          control === 'cancel' ? (
            <Button key={control} variant="outline" disabled={busy !== null} onClick={() => setConfirming(true)}>
              {CONTROL_LABEL.cancel}
            </Button>
          ) : (
            <Button key={control} variant="outline" pending={busy === control} disabled={busy !== null} onClick={() => void run(control)}>
              {CONTROL_LABEL[control]}
            </Button>
          ),
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Gönderim iptal edilsin mi?"
        description={cancelConfirmText(send)}
        actionLabel="Gönderimi iptal et"
        cancelLabel="Vazgeç"
        destructive
        pending={busy === 'cancel'}
        onAction={() => void run('cancel')}
      />
      {problem ? (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
