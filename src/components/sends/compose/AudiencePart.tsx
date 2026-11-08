'use client';

import { Badge, FilterPills, Notice } from '@skylab-kulubu/skylcn-ui';
import type { ListRow } from '@/lib/mailing-lists';
import { formatCount } from '@/lib/sends';
import type { SendAccess } from '@/lib/send-form/access';
import type { PeopleCheck } from '@/lib/send-form/audience';
import { ChoiceList, type Choice } from './ChoiceList';
import { PeopleEditor, type PersonEntry } from './PeopleEditor';
import type { FormSource } from '@/lib/form-mail-source';
import { FormSourceCard } from '../FormSourceCard';
import type { TeamAudience } from '@/lib/send-form/teams';
import { TeamPicker } from './TeamPicker';

export type Audience = 'list' | 'people' | 'form' | 'team';

/** The audiences the form offers, in order: the Leader's Teams (ekip-postasi 05), a list, people. */
function audienceOptions(access: SendAccess, teams: boolean): Array<{ value: Audience; label: string }> {
  return [
    ...(teams ? [{ value: 'team' as const, label: 'Ekibim' }] : []),
    ...(access.list ? [{ value: 'list' as const, label: 'Mail listesi' }] : []),
    ...(access.people ? [{ value: 'people' as const, label: 'Kişiler' }] : []),
  ];
}

/** A mailing list as the picker says it: by name, with its Harici tag and group, or as an internal list. */
function listChoice(list: ListRow): Choice {
  return {
    name: list.name,
    tag: list.external ? <Badge tone="warning" size="xs">Harici</Badge> : undefined,
    detail: list.external ? (list.groupPath ?? 'Keycloak grubu') : 'Internal liste',
  };
}

/** How many a list sends to, said under it: undefined while counting, null when unknown. */
function sizeText(list: ListRow, size: number | null | undefined): string {
  if (size === undefined) return 'Alıcılar sayılıyor…';
  if (size === null) return 'Alıcı sayısı alınamadı.';
  return list.external ? `${formatCount(size)} üye. E-posta adresi olmayan üyeye gönderilmez.` : `${formatCount(size)} alıcı.`;
}

/** Who it goes to: the Leader's Teams, a mailing list or Keycloak group with its size, or people one by one. */
export function AudiencePart({
  access,
  audience,
  onAudience,
  lists,
  listId,
  onList,
  list,
  size,
  listProblem,
  people,
  onPeople,
  peopleCheck,
  peopleWarnings,
  onSend,
  formSource,
  teams = [],
  pickedTeams,
  onPickedTeams,
  teamsProblem = null,
  disabled = false,
}: {
  access: SendAccess;
  audience: Audience;
  onAudience: (audience: Audience) => void;
  lists: readonly ListRow[];
  listId: string | null;
  onList: (id: string) => void;
  list: ListRow | null;
  size: number | null | undefined;
  listProblem: string | null;
  people: readonly PersonEntry[];
  onPeople: (rows: PersonEntry[]) => void;
  /** Shown once the sender has tried to send, or the API refused a person. */
  peopleCheck: Pick<PeopleCheck, 'rows' | 'none'> | null;
  peopleWarnings: readonly (string | null)[];
  onSend: () => void;
  formSource?: FormSource | null;
  /** The Teams the viewer leads; none: no Ekibim. */
  teams?: readonly TeamAudience[];
  pickedTeams: ReadonlySet<string>;
  onPickedTeams: (picked: Set<string>) => void;
  teamsProblem?: string | null;
  disabled?: boolean;
}) {
  if (audience === 'form') return formSource
    ? <FormSourceCard source={formSource} />
    : <Notice tone="danger">Forms kaynağı kullanılamıyor. Forms'tan yeniden hazırla.</Notice>;
  const options = audienceOptions(access, teams.length > 0);
  return (
    <>
      {options.length > 1 ? (
        <FilterPills aria-label="Kime" value={audience} onValueChange={onAudience} options={options} />
      ) : null}
      {!access.list && teams.length === 0 && access.listNote ? <Notice tone="info">{access.listNote}</Notice> : null}
      {audience === 'team' ? (
        <TeamPicker teams={teams} picked={pickedTeams} onPicked={onPickedTeams} error={teamsProblem} disabled={disabled} />
      ) : audience === 'list' ? (
        <>
          <ChoiceList
            legend="Mail listesi"
            items={lists}
            value={listId}
            onChange={onList}
            searchLabel="Liste ara"
            searchText={(candidate) => `${candidate.name} ${candidate.groupPath ?? ''}`}
            choice={listChoice}
            empty="Gönderilebilecek bir mail listesi yok."
            error={listProblem}
          />
          {list ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {sizeText(list, size)}
            </p>
          ) : null}
        </>
      ) : (
        <PeopleEditor rows={people} onChange={onPeople} check={{ shown: peopleCheck, warnings: peopleWarnings }} onSend={onSend} />
      )}
    </>
  );
}
