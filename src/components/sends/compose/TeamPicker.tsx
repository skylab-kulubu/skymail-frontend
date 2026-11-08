'use client';

// The Teams a Leader mails (ekip-postasi 05): the tree skymail-backend lists,
// indented, any number picked. A Sub-team under a picked Team is shown
// picked and fixed: the Team above reaches its members, and the request
// leaves it out (ADR 0067 addendum). Each row says how many it reaches; the
// Leader never sees an address. Native checkboxes in a fieldset, as
// ChoiceList's radios, so a screen reader hears the group.

import { useId, type ReactNode } from 'react';
import { COMMERCIAL_STATEMENT } from '@/lib/send-form/purpose';
import {
  TEAM_ADDRESSES_NOTE,
  TEAM_PURPOSE_NOTE,
  TEAM_PURPOSE_TEXT,
  coveredTeams,
  pickedCountText,
  requestTeams,
  teamCountText,
  teamName,
  type TeamAudience,
} from '@/lib/send-form/teams';

export function TeamPicker({
  teams,
  picked,
  onPicked,
  error,
  disabled,
}: {
  teams: readonly TeamAudience[];
  picked: ReadonlySet<string>;
  onPicked: (picked: Set<string>) => void;
  /** What keeps the Teams from going, once the sender has tried. */
  error: string | null;
  disabled: boolean;
}) {
  const errorId = useId();
  const covered = coveredTeams(picked, teams);
  const count = pickedCountText(requestTeams(picked, teams));

  function toggle(id: string, on: boolean) {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    onPicked(next);
  }

  return (
    <fieldset className="min-w-0 space-y-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-xs font-medium text-secondary-foreground">Ekip</legend>
      <div className={`max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1 ${error ? 'border-destructive/50' : 'border-border'}`}>
        {teams.length === 0 ? <p className="px-3 py-3 text-xs text-subtle-foreground">Şu an lideri olduğun bir ekip görünmüyor.</p> : null}
        {teams.map((team) => {
          const under = covered.has(team.id);
          return (
            <TeamRow
              key={team.id}
              team={team}
              checked={picked.has(team.id) || under}
              fixed={under}
              disabled={disabled}
              invalid={Boolean(error)}
              onChange={(on) => toggle(team.id, on)}
            />
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : count ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {count}
        </p>
      ) : null}
    </fieldset>
  );
}

function TeamRow({
  team,
  checked,
  fixed,
  disabled,
  invalid,
  onChange,
}: {
  team: TeamAudience;
  checked: boolean;
  /** A Team above it is picked: it goes with that one. */
  fixed: boolean;
  disabled: boolean;
  invalid: boolean;
  onChange: (on: boolean) => void;
}) {
  const detailId = useId();
  return (
    <label
      className={`has-[:checked]:border-skylab-400/50 has-[:checked]:bg-skylab-500/10 has-[:focus-visible]:ring-skylab-400/40 flex items-start gap-3 rounded-md border border-transparent px-3 py-2 has-[:focus-visible]:ring-2 ${fixed ? 'cursor-default' : 'cursor-pointer hover:bg-accent'}`}
      style={{ paddingLeft: `${0.75 + team.depth * 1.25}rem` }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || fixed}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={teamName(team)}
        aria-describedby={detailId}
        aria-invalid={invalid ? true : undefined}
        className="accent-skylab-400 mt-0.5 shrink-0 outline-hidden"
      />
      <span className="block min-w-0 flex-1">
        <span className="text-sm break-words text-foreground">{teamName(team)}</span>
        <span id={detailId} className="text-2xs mt-0.5 block text-subtle-foreground">
          {fixed ? `${teamCountText(team)} · Üst ekiple birlikte gider` : teamCountText(team)}
        </span>
      </span>
    </label>
  );
}

/** A Team request's purpose: fixed, and the statement it does not go without. */
export function TeamPurpose({
  commercialAbsent,
  onCommercialAbsent,
  problem,
  disabled,
  addressesNote = true,
}: {
  commercialAbsent: boolean;
  onCommercialAbsent: (checked: boolean) => void;
  problem: string | null;
  disabled: boolean;
  /** Say the sender sees no address: not to one who reads lists, who does. */
  addressesNote?: boolean;
}): ReactNode {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        <span className="text-xs text-subtle-foreground">Amaç: </span>
        {TEAM_PURPOSE_TEXT}
      </p>
      <p className="text-xs text-subtle-foreground">{addressesNote ? `${TEAM_PURPOSE_NOTE} ${TEAM_ADDRESSES_NOTE}` : TEAM_PURPOSE_NOTE}</p>
      <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={commercialAbsent}
          onChange={(event) => onCommercialAbsent(event.target.checked)}
          disabled={disabled}
          className="accent-skylab-500 mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
        />
        <span>{COMMERCIAL_STATEMENT}</span>
      </label>
      {problem ? (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
