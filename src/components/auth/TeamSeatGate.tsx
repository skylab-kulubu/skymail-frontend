'use client';

// Someone signed in without skymail:access (ekip-postasi 06; skymail-backend
// #128). A Leader — core says they lead a Team — gets the team seat: the
// panel with their Teams, a free announcement and their own requests,
// whatever other SkyMail role their token carries. Anyone else, or while
// Team mail is off (404), gets "Erişimin yok" (`denied`). While core or
// SkyMail does not answer it is not known which they are: the screen says
// both, a way to try again and the sign-out "Erişimin yok" has.

import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, StateCard } from '@skylab-kulubu/skylcn-ui';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { ConsoleShell } from '@/components/layout/ConsoleShell';
import type { ConsoleUser, RefreshRoles } from '@/components/layout/ConsoleContext';
import { ApiProvider, useApiLoad } from '@/lib/api/react';
import type { PublicConfig } from '@/lib/runtime-config';
import { signOutOfKeycloak } from '@/lib/auth/actions';
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

/** Said while it is not known whether the viewer leads a Team: true for a Leader and for anyone else. */
export const TEAM_SEAT_UNKNOWN =
  'Bu hesapta İletişim konsolu yetkisi yok. Ekip lideriysen ekiplerine buradan duyuru gönderebilirsin, ama liderlik bilgisi şu an okunamadı; birkaç saniye sonra yeniden dene.';

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
        title="Erişimin şu an doğrulanamadı"
        description={TEAM_SEAT_UNKNOWN}
        actions={
          <div className="flex w-full flex-col gap-2">
            <Button variant="primary" size="lg" className="w-full" onClick={() => setRound((count) => count + 1)}>
              Tekrar dene
            </Button>
            <form action={signOutOfKeycloak} className="w-full">
              <Button type="submit" variant="outline" size="lg" className="w-full">
                Başka bir hesapla giriş yap
              </Button>
            </form>
          </div>
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
