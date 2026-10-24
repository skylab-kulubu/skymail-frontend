'use client';

// The send's purpose, its category and the statement it goes with
// (send-form/purpose.ts), on the form's own controls: FilterPills, Select
// and the box the tracking choice uses. Shown only while the backend takes a
// purpose.

import type { ReactNode } from 'react';
import { FilterPills, Select } from '@skylab-kulubu/skylcn-ui';
import type { ListRow } from '@/lib/mailing-lists';
import {
  CLUB,
  COMMERCIAL_STATEMENT,
  KIND_OPTIONS,
  OWN_EVENT_STATEMENT,
  PURPOSE_LABEL,
  PURPOSE_OPTIONS,
  SOURCE_OPTIONS,
  TRANSACTIONAL_STATEMENT,
  ownEventOffered,
  purposeChoosable,
  purposeOf,
  sourceOf,
  teamOptions,
  type CategoryKind,
  type Purpose,
  type PurposeAudience,
  type PurposeChoice,
} from '@/lib/send-form/purpose';

function Statement({ checked, onChange, disabled, children }: { checked: boolean; onChange: (checked: boolean) => void; disabled: boolean; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="accent-skylab-500 mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
      />
      <span>{children}</span>
    </label>
  );
}

export function PurposePart({
  choice,
  onChoice,
  audience,
  list,
  lists,
  categoryProblem,
  listConsent = false,
  problem,
  disabled,
}: {
  choice: PurposeChoice;
  onChoice: (choice: PurposeChoice) => void;
  audience: PurposeAudience;
  list: ListRow | null;
  lists: readonly ListRow[];
  /** The API's refusal of the category, said under it. */
  categoryProblem: string | null;
  /** The backend holds a list's guests to their announcement consent: the own event box is offered for a list. */
  listConsent?: boolean;
  /** What keeps the send from going, once the sender has tried. */
  problem: string | null;
  disabled: boolean;
}) {
  const purpose = purposeOf(choice, audience);
  const source = sourceOf(choice, list);
  const team = choice.team || source !== CLUB;
  const teams = teamOptions(lists);
  const set = (change: Partial<PurposeChoice>) => onChoice({ ...choice, ...change });

  return (
    <div className="space-y-3">
      {purposeChoosable(audience) ? (
        <FilterPills aria-label="Amaç" value={purpose} options={PURPOSE_OPTIONS} onValueChange={(next: Purpose) => set({ purpose: next })} />
      ) : (
        <p className="text-sm text-foreground">
          <span className="text-xs text-subtle-foreground">Amaç: </span>
          {PURPOSE_LABEL.duyuru}
        </p>
      )}

      {purpose === 'islem' ? (
        <Statement checked={choice.transactional} onChange={(checked) => set({ transactional: checked })} disabled={disabled}>
          {TRANSACTIONAL_STATEMENT}
        </Statement>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills
              aria-label="Kategori kaynağı"
              value={team ? 'team' : 'club'}
              options={SOURCE_OPTIONS}
              onValueChange={(next: 'club' | 'team') =>
                set(next === 'club' ? { team: false, source: CLUB } : { team: true, source: list?.external ? list.id.toLowerCase() : null })
              }
            />
            {team ? (
              <Select
                aria-label="Ekip"
                value={source === CLUB ? null : source.toLowerCase()}
                options={teams}
                placeholder="Ekip seç"
                onValueChange={(next) => set({ team: true, source: next })}
                disabled={disabled}
              />
            ) : null}
            <FilterPills aria-label="Tür" value={choice.kind} options={KIND_OPTIONS} onValueChange={(next: CategoryKind) => set({ kind: next })} />
          </div>
          {categoryProblem ? <p role="alert" className="text-xs text-destructive">{categoryProblem}</p> : null}
          <Statement checked={choice.commercialAbsent} onChange={(checked) => set({ commercialAbsent: checked })} disabled={disabled}>
            {COMMERCIAL_STATEMENT}
          </Statement>
          {ownEventOffered(audience, listConsent) ? (
            <Statement checked={choice.ownEvent} onChange={(checked) => set({ ownEvent: checked })} disabled={disabled}>
              {OWN_EVENT_STATEMENT}
            </Statement>
          ) : null}
        </>
      )}
      {problem ? <p role="alert" className="text-xs text-destructive">{problem}</p> : null}
    </div>
  );
}
