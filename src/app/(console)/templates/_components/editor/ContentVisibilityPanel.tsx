'use client';

/**
 * Whether the content of the template's sends opens on a send's page as sent
 * or masked (skymail-backend, sent mail content): masked, the server hides
 * every code and one-time link and shows the rest. Either way, with a
 * confirmation. A template whose mail carries a credential is locked masked;
 * its switch is off and cannot be turned on. The server records who changed
 * it.
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
        title="İçerik panelde maskesiz görünsün"
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
          title={asking ? 'İçerik panelde maskesiz görünsün mü?' : 'İçerik maskelensin mi?'}
        >
          <p>
            {asking
              ? `“${current.name}” ile gönderilen postaların içeriği (konu, gövde) gönderim sayfasında maskesiz, gönderildiği hâliyle açılabilecek: gönderene, toplu gönderimlerde gönderme yetkisi olanlara ve SkyMail yöneticilerine. Hâlâ saklanan eski gönderimler de dahil. Postada kod ya da tek kullanımlık bağlantı varsa açma.`
              : `“${current.name}” ile gönderilen postaların içeriği maskeli açılacak: kodlar ve tek kullanımlık bağlantılar gizlenir, gerisi görünür; her açılış kaydedilir. Saklanan içerik silinmez.`}
          </p>
          {error ? (
            <div className="mt-3">
              <Notice tone="danger">{error}</Notice>
            </div>
          ) : null}
          <PrimaryActions
            onCancel={() => setAsking(null)}
            onConfirm={() => void confirm(asking)}
            confirmLabel={asking ? 'Maskesiz göster' : 'Maskele'}
            pendingLabel="Kaydediliyor…"
            isPending={busy}
          />
        </PanelDialog>
      ) : null}
    </section>
  );
}
