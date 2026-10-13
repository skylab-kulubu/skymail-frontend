'use client';

/**
 * Whether the content of the template's sends opens on a send's page
 * (skymail-backend, sent mail content). Either way, with a confirmation: to
 * show it lets senders and administrators read what went out; to hide it
 * empties what is kept of its finished sends within minutes, for good. A
 * template whose mail carries a credential is locked hidden; its switch is
 * off and cannot be turned on. The server records who changed it.
 */
import { useState } from 'react';
import { Notice, ToggleRow } from '@skylab-kulubu/skylcn-ui';
import { PanelDialog, PrimaryActions } from '@/components/common/PanelDialog';
import { apiErrorMessage } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import { contentVisibility, setContentSensitive, type MailTemplate } from '@/lib/templates';

export function ContentVisibilityPanel({ template }: { template: MailTemplate }) {
  const api = useApi();
  const [current, setCurrent] = useState(template);
  const [asking, setAsking] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibility = contentVisibility(current);
  if (!visibility) return null;

  async function confirm(show: boolean) {
    setBusy(true);
    setError(null);
    try {
      setCurrent(await setContentSensitive(api, current.id, !show));
      setAsking(null);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Gönderilen içerik" className="space-y-2">
      <ToggleRow
        title="İçerik panelde görünsün"
        description={visibility.text}
        checked={visibility.shown}
        disabled={visibility.locked || busy}
        onCheckedChange={(checked: boolean) => {
          setError(null);
          setAsking(checked);
        }}
      />
      {error && asking === null ? <Notice tone="danger">{error}</Notice> : null}
      {asking !== null ? (
        <PanelDialog
          isOpen
          onClose={() => (busy ? undefined : setAsking(null))}
          title={asking ? 'İçerik panelde görünsün mü?' : 'İçerik gizlensin mi?'}
        >
          <p>
            {asking
              ? `“${current.name}” ile gönderilen postaların içeriği (konu, gövde) gönderim sayfasında açılabilecek: gönderene, toplu gönderimlerde gönderme yetkisi olanlara ve SkyMail yöneticilerine. Hâlâ saklanan eski gönderimler de dahil. Postada kod ya da tek kullanımlık bağlantı varsa açma.`
              : `“${current.name}” ile gönderilen postaların içeriği kimseye gösterilmeyecek. Bitmiş gönderimlerinin saklanan içeriği birkaç dakika içinde kalıcı olarak silinir; geri açsan da geri gelmez.`}
          </p>
          {error ? (
            <div className="mt-3">
              <Notice tone="danger">{error}</Notice>
            </div>
          ) : null}
          <PrimaryActions
            onCancel={() => setAsking(null)}
            onConfirm={() => void confirm(asking)}
            confirmLabel={asking ? 'Göster' : 'Gizle'}
            pendingLabel="Kaydediliyor…"
            isPending={busy}
          />
        </PanelDialog>
      ) : null}
    </section>
  );
}
