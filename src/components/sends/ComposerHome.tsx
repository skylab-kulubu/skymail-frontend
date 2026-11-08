'use client';

// The home screen of one who may compose a send but not read the send list
// (`mails:read`): a team leader, who holds access and templates:read. What
// they can do is a new send, which goes for approval, and follow what they
// submitted; the summary's lock would tell them neither. Laid out as the
// summary's recent sends: a section title, a few rows, Tümünü gör.

import Link from 'next/link';
import { AlertTriangle, ArrowRight, ClipboardCheck, Plus } from 'lucide-react';
import { Button, StateCard } from '@skylab-kulubu/skylcn-ui';
import { NavButton } from '@/components/common/NavButton';
import { PageHeader } from '@/components/layout/PageHeader';
import { ApprovalRow } from '@/components/mail-approvals/ApprovalList';
import { useConsole } from '@/components/layout/ConsoleContext';
import { isApprover, sectionLabel } from '@/lib/access';
import { useApiLoad } from '@/lib/api/react';
import { approvalListHref, fetchOwnApprovals } from '@/lib/mail-approvals/approvals';
import { composeHref } from '@/lib/sends';
import { SectionTitle } from './SectionTitle';

const RECENT = 5;

/** `teamSeat`: a Leader without skymail:access, who sends only to their Teams (ekip-postasi 06). */
export function ComposerHome({ teamSeat = false }: { teamSeat?: boolean }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={sectionLabel('/')}
        description={
          teamSeat
            ? 'Ekiplerine duyuru hazırla, onaya sunduklarını buradan izle.'
            : 'Yeni bir gönderim hazırla, onaya sunduklarını buradan izle.'
        }
        actions={
          <NavButton variant="primary" href={composeHref()}>
            <Plus aria-hidden />
            {teamSeat ? 'Ekibime gönder' : 'Yeni gönderim'}
          </NavButton>
        }
      />
      <OwnRequests />
    </div>
  );
}

function OwnRequests() {
  const { roles } = useConsole();
  // All of the viewer's own requests, whatever their state: an approver's
  // list otherwise opens on everyone's pending ones.
  const approver = isApprover(roles);
  const allOwn = approvalListHref({ state: 'all', mine: true, page: 1 }, { approver });
  const state = useApiLoad((api, signal) => fetchOwnApprovals(api, RECENT, signal), 'own-approvals');
  const now = new Date();

  return (
    <section aria-labelledby="own-requests-title">
      <SectionTitle
        id="own-requests-title"
        aside={
          <Link
            href={allOwn}
            className="text-2xs inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-secondary-foreground"
          >
            Tümünü gör
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        }
      >
        Onaya sunduklarım
      </SectionTitle>
      {state.status === 'loading' ? (
        <StateCard loading title="İstekler yükleniyor" />
      ) : state.status === 'error' ? (
        <StateCard icon={AlertTriangle} tone="danger" title="İstekler yüklenemedi" description={state.error.message}>
          <Button variant="outline" onClick={() => void state.reload()}>
            Tekrar dene
          </Button>
        </StateCard>
      ) : state.data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-border-subtle py-10 text-center">
          <ClipboardCheck className="mb-1 h-6 w-6 text-faint-foreground" strokeWidth={1.5} aria-hidden />
          <p className="text-xs text-muted-foreground">Henüz onaya sunduğun bir gönderim yok.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
          {state.data.items.map((item) => (
            <ApprovalRow key={item.id} item={item} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
