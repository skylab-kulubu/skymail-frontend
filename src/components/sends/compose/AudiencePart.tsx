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

export type Audience = 'list' | 'people' | 'form';

const AUDIENCE_OPTIONS: ReadonlyArray<{ value: Audience; label: string }> = [
  { value: 'list', label: 'Mail listesi' },
  { value: 'people', label: 'Kişiler' },
];

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

/** Who it goes to: a mailing list or Keycloak group with its size, or people one by one. */
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
}) {
  if (audience === 'form') return formSource
    ? <FormSourceCard source={formSource} />
    : <Notice tone="danger">Forms kaynağı kullanılamıyor. Forms'tan yeniden hazırla.</Notice>;
  return (
    <>
      {access.list ? (
        <FilterPills aria-label="Kime" value={audience} onValueChange={onAudience} options={AUDIENCE_OPTIONS} />
      ) : (
        <Notice tone="info">{access.listNote}</Notice>
      )}
      {audience === 'list' ? (
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
