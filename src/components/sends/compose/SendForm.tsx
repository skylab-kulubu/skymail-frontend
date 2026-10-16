'use client';

// A new send (ticket 16): a Mail template or a free announcement, to a
// mailing list or to people one by one, with the template's variables filled
// in and the mail previewed as it goes out. superadmin links an Event's list
// here as ?mail_list_id=<id>, and the list is preselected. Only a template's
// published version is ever sent; a free announcement's body is written in
// the Visual editor and still goes through the server's allow-list.
//
// What the viewer may not send they submit for approval (ticket 20). The
// same form, filled from a request for approval, resubmits a rejected or
// declined one (`/mail-approvals/edit/:id`) or starts a new one from it
// (`?from_approval=<id>`, after it expired).
//
// Who may open it: anyone with access (access.ts requiredRolesFor); a
// template to send needs templates:read.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, SearchX } from 'lucide-react';
import { PrefillIntro } from '@/components/mail-approvals/PrefillIntro';
import { Button, Notice, StateCard } from '@skylab-kulubu/skylcn-ui';
import { useConsole } from '@/components/layout/ConsoleContext';
import { RoleGate } from '@/components/layout/RoleGate';
import { ROLE } from '@/lib/access';
import { useApi, useApiLoad } from '@/lib/api/react';
import { apiErrorMessage } from '@/lib/api/errors';
import { approvalViewer, viewerActions } from '@/lib/mail-approvals/actions';
import { APPROVAL_LIST_PATH, APPROVAL_PEOPLE_LIMIT, APPROVAL_STATE_LABEL, approvalHref, fetchApproval } from '@/lib/mail-approvals/approvals';
import { composePrefill, resubmission } from '@/lib/mail-approvals/edit';
import type { ListRow } from '@/lib/mailing-lists';
import { sendAccess } from '@/lib/send-form/access';
import { fetchSendableLists, fetchSendableTemplates, freeTemplate } from '@/lib/send-form/send';
import { formsHandoffMatches, formsRecipients, formsSourceHandoff, parseFormsHandoff, type FormsRecipients } from '@/lib/forms-handoff';
import { audienceFormSource, fetchFormSource, type PreparedFormSource } from '@/lib/form-mail-source';
import { FormSourceCard } from '../FormSourceCard';
import { Compose } from './Compose';

export function SendForm() {
  const params = useSearchParams();
  const from = params.get('from_approval');
  const { user } = useConsole();
  const handoff = params.has('forms_handoff') || params.get('source') === 'forms';
  return (
    <RoleGate role={ROLE.templatesRead}>
      {handoff
        ? <FormsCompose key={`${params.toString()}:${user.sub}`} query={params.toString()} />
        : <ComposeCatalog from={from ? { kind: 'copy', id: from } : null} />}
    </RoleGate>
  );
}

/** Recipients arrive only after login, from the exact Forms window that opened this one. */
function FormsCompose({ query }: { query: string }) {
  const api = useApi();
  const { config, user } = useConsole();
  const binding = useMemo(() => parseFormsHandoff(new URLSearchParams(query)), [query]);
  const formsUrl = config.consoles.find((console) => console.id === 'forms')?.href;
  const origin = useMemo(() => {
    try { return formsUrl ? new URL(formsUrl).origin : null; } catch { return null; }
  }, [formsUrl]);
  const [people, setPeople] = useState<FormsRecipients | null>(null);
  const [source, setSource] = useState<PreparedFormSource | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const consumed = useRef(false);

  useEffect(() => {
    if (!binding || !origin || !user.sub) return;
    const opener = window.opener as Window | null;
    let active = true;
    let ready = false;
    const controller = new AbortController();
    const stop = () => {
      active = false;
      window.removeEventListener('message', receive);
      window.removeEventListener('pagehide', stop);
      window.clearTimeout(timer);
      controller.abort();
    };
    const fail = (message: string) => {
      if (!active) return;
      stop();
      setProblem(message);
    };
    const receive = async (event: MessageEvent) => {
      if (!active || !ready || consumed.current || event.origin !== origin || event.source !== opener
          || !formsHandoffMatches(event.data, binding)) return;
      const value = event.data;
      if (value.type === 'skyforms:mail:error') {
        fail(value.code === 'empty' ? 'Bu formda e-posta adresi kullanılabilen yanıtlayan yok.' : 'Aktarım tamamlanamadı. Forms sayfasından yeniden başlat.');
        return;
      }
      const data = formsRecipients(value, binding, user.sub!);
      const candidate = formsSourceHandoff(value, binding, user.sub!);
      if (!data && !candidate) return;
      consumed.current = true;
      const session = await getSession().catch(() => null);
      if (!active) return;
      if (Date.now() >= binding.expires || session?.error || session?.subject !== user.sub) {
        fail('Oturum değişti veya aktarımın süresi doldu. Forms sayfasından yeniden başlat.');
        return;
      }
      let verified: PreparedFormSource | null = null;
      if (candidate) {
        try { verified = await fetchFormSource(api, candidate.sourceId, binding.formId, user.sub!, controller.signal); }
        catch (error) { if (active) fail(`Forms kaynağı doğrulanamadı. ${apiErrorMessage(error)} Forms'tan yeniden hazırla.`); return; }
        if (!active) return;
        const current = await getSession().catch(() => null);
        if (!active) return;
        if (Date.now() >= binding.expires || current?.error || current?.subject !== user.sub) {
          fail('Oturum değişti veya aktarımın süresi doldu. Forms sayfasından yeniden başlat.');
          return;
        }
      }
      opener!.postMessage({ type: 'skyforms:mail:accepted', ...binding, subject: user.sub }, origin);
      stop();
      window.opener = null;
      if (verified) setSource(verified);
      else setPeople(data);
    };
    const timer = window.setTimeout(() => fail('Aktarımın süresi doldu. Forms sayfasından yeniden başlat.'), binding.expires - Date.now());
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', stop);
    void getSession().then((session) => {
      if (!active) return;
      if (!opener || opener.closed || session?.error || session?.subject !== user.sub) {
        fail('Forms sayfasındaki “Yanıtlayanlara mail gönder” düğmesinden, aynı hesapla yeniden başlat.');
        return;
      }
      ready = true;
      opener.postMessage({ type: 'skyforms:mail:ready', ...binding, subject: user.sub }, origin);
    }).catch(() => fail('Oturum doğrulanamadı. Forms sayfasından yeniden başlat.'));
    return stop;
  }, [api, binding, origin, user.sub]);

  if (!binding || !origin || !user.sub || problem) {
    return <StateCard icon={AlertTriangle} tone="warning" title="Alıcılar aktarılamadı" description={problem ?? 'Aktarım adresi geçersiz veya süresi dolmuş. Forms sayfasından yeniden başlat.'} />;
  }
  if (!people && !source) return <StateCard loading title="Forms alıcıları bekleniyor" description="Aktarım tamamlanana kadar Forms sayfasını açık tut." />;
  return <ComposeCatalog from={null} forms={people ?? undefined} formSource={source ?? undefined} />;
}

/** A rejected or declined request, edited and submitted again. */
export function ResubmitForm({ id }: { id: string }) {
  return (
    <RoleGate role={ROLE.templatesRead}>
      <ComposeCatalog from={{ kind: 'resubmit', id }} />
    </RoleGate>
  );
}

type From = Readonly<{ kind: 'copy' | 'resubmit'; id: string }>;

/** The templates and lists to pick from, and the request the form is filled from, loaded once. */
function ComposeCatalog({ from, forms, formSource }: { from: From | null; forms?: FormsRecipients; formSource?: PreparedFormSource }) {
  const { roles, user } = useConsole();
  const access = sendAccess(roles);
  const catalog = useApiLoad(
    async (api, signal) => {
      const [templates, lists, approval] = await Promise.all([
        fetchSendableTemplates(api, signal),
        access.list ? fetchSendableLists(api, signal) : Promise.resolve<ListRow[]>([]),
        from ? fetchApproval(api, from.id, signal) : Promise.resolve(null),
      ]);
      return { templates, lists, approval };
    },
    `${access.list ? 'templates+lists' : 'templates'}:${from?.kind ?? ''}:${from?.id ?? ''}`,
  );
  if (catalog.status === 'loading') return <StateCard loading title="Template'ler ve listeler yükleniyor" />;
  if (catalog.status === 'error') {
    if (from && catalog.error.status === 404) {
      return (
        <StateCard icon={SearchX} title="İstek bulunamadı" description="Bu adreste bir onay isteği yok ya da görme yetkin yok.">
          <Link href={APPROVAL_LIST_PATH} className="text-skylab-300 text-sm hover:underline">
            Mail onaylarına dön
          </Link>
        </StateCard>
      );
    }
    return (
      <StateCard icon={AlertTriangle} tone="danger" title="Gönderim formu açılamadı" description={catalog.error.message}>
        <Button variant="outline" onClick={() => void catalog.reload()}>
          Tekrar dene
        </Button>
      </StateCard>
    );
  }

  const { templates, lists, approval } = catalog.data;
  if (formSource) return <Compose access={access} templates={templates} lists={lists}
    prefill={{ what: freeTemplate(templates) ? 'free' : 'template', templateId: null, audience: 'form', formSource, listId: null, people: [], values: {}, rich: {}, notes: [] }}
    intro={<Notice tone="info">Forms kaynağı doğrulandı. Yeni yanıtlar bu gönderimin alıcılarını değiştirmez.
      {formSource.skipped_count > 0 && ` Kullanılabilir e-postası olmayan ${formSource.skipped_count} yanıt atlandı.`}
      {formSource.duplicate_count > 0 && ` Aynı adrese ait ${formSource.duplicate_count} tekrar çıkarıldı.`}
    </Notice>} />;
  if (forms) {
    return (
      <Compose access={access} templates={templates} lists={lists}
        prefill={{ what: freeTemplate(templates) ? 'free' : 'template', templateId: null, audience: 'people', listId: null, people: forms.recipients, values: {}, rich: {}, notes: [] }}
        intro={<Notice tone="info">
          Eski aktarım: “{forms.formTitle}” formundan {forms.recipients.length} kişi eklendi; bu gönderimde kalıcı Forms bağlantısı tutulmaz. Arşivlenen, geçici ve düzeltme istenen yanıtlar dahil değildir.
          {forms.skippedCount > 0 && ` E-posta adresi alınamayan veya kullanılamayan ${forms.skippedCount} yanıt atlandı.`}
          {forms.duplicateCount > 0 && ` Aynı adrese ait ${forms.duplicateCount} tekrar çıkarıldı.`}
          {forms.recipients.length > APPROVAL_PEOPLE_LIMIT && ` Onaya en çok ${APPROVAL_PEOPLE_LIMIT} kişi sunulabilir; daha kalabalık bir gönderim için mevcut mail listesi yolunu kullan.`}
        </Notice>}
      />
    );
  }
  if (!from || !approval) return <Compose access={access} templates={templates} lists={lists} />;
  if (from.kind === 'copy' && approval.audience.kind === 'form') {
    return <StateCard icon={AlertTriangle} tone="warning" title="Forms alıcılarını yeniden hazırla" description="Önceki isteğin kaynağı yeniden kullanılamaz. Formun yanıtlarından yeni bir gönderim hazırla.">
      <FormSourceCopy audience={approval.audience} />
    </StateCard>;
  }

  if (from.kind === 'resubmit') {
    const { state, actions } = viewerActions(approval, approvalViewer(roles, user));
    if (!actions.includes('resubmit')) {
      return (
        <StateCard
          icon={AlertTriangle}
          tone="warning"
          title="Bu istek yeniden sunulamaz"
          description={`Yalnız isteği sunan, reddedilen ya da düzenlemesi kabul edilmeyen bir isteği yeniden sunabilir. Bu istek: ${APPROVAL_STATE_LABEL[state]}.`}
        >
          <Link href={approvalHref(approval.id)} className="text-skylab-300 text-sm hover:underline">
            İsteğe dön
          </Link>
        </StateCard>
      );
    }
  }

  const source = from.kind === 'resubmit' ? resubmission(approval) : approval;
  const prefill = composePrefill(source, { templates, lists, access });
  return (
    <Compose
      access={access}
      templates={templates}
      lists={lists}
      mode={{ kind: from.kind, approval }}
      prefill={prefill}
      intro={<PrefillIntro approval={approval} mode={from.kind} notes={prefill.notes} />}
    />
  );
}

function FormSourceCopy({ audience }: { audience: import('@/lib/sends').SendAudience }) {
  const source = audienceFormSource(audience);
  return source ? <FormSourceCard source={source} /> : null;
}
