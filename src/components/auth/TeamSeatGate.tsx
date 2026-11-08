'use client';

// Someone signed in without skymail:access (ekip-postasi 06; skymail-backend
// #128). A Leader — core says they lead a Team — gets the team seat: the
// panel with their Teams, a free announcement and their own requests,
// whatever other SkyMail role their token carries. Anyone else, or while
// Team mail is off (404), gets "Erişimin yok" (`denied`). Core not answering
// is said as that, not as no access.

import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, StateCard } from '@skylab-kulubu/skylcn-ui';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { ConsoleShell } from '@/components/layout/ConsoleShell';
import type { ConsoleUser, RefreshRoles } from '@/components/layout/ConsoleContext';
import { ApiProvider, useApiLoad } from '@/lib/api/react';
import type { PublicConfig } from '@/lib/runtime-config';
import { fetchTeamAudiences, teamsOf } from '@/lib/send-form/teams';

type Props = Readonly<{
  roles: readonly string[];
  user: ConsoleUser;
  config: PublicConfig;
  refreshRoles: RefreshRoles;
  /** "Erişimin yok", rendered by the layout. */
  denied: ReactNode;
  children: ReactNode;
}>;

export function TeamSeatGate(props: Props) {
  return (
    <ApiProvider baseUrl={props.config.apiUrl}>
      <Seat {...props} />
    </ApiProvider>
  );
}

function Seat({ roles, user, config, refreshRoles, denied, children }: Props) {
  // Keyed by the person: a sign-in as someone else asks again.
  const [round, setRound] = useState(0);
  const answer = useApiLoad((api, signal) => fetchTeamAudiences(api, signal), `team-seat:${user.sub ?? ''}:${round}`);

  if (answer.status === 'loading') return <StateCard loading title="Yükleniyor" />;
  if (answer.status === 'error' || answer.data.status === 'unavailable') {
    return (
      <AuthScreen
        Icon={AlertTriangle}
        tone="warning"
        title="Şu an açılamadı"
        description={answer.status === 'success' && answer.data.status === 'unavailable' ? answer.data.message : answer.error?.message}
        actions={
          <Button variant="outline" size="lg" className="w-full" onClick={() => setRound((count) => count + 1)}>
            Tekrar dene
          </Button>
        }
      />
    );
  }
  const teams = teamsOf(answer.data);
  if (teams.length === 0) return <>{denied}</>;
  return (
    <ConsoleShell roles={roles} user={user} config={config} refreshRoles={refreshRoles} teamSeat={teams}>
      {children}
    </ConsoleShell>
  );
}
