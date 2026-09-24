'use client';

import { useId, useState, type ReactNode } from 'react';
import { FormField } from '@/components/chrome/FormField';

/**
 * How a choice reads. Its name is the radio's accessible name; its tag and
 * detail are the radio's description, said after the name.
 */
export type Choice = {
  name: string;
  /** Beside the name: System, Harici. */
  tag?: ReactNode;
  /** Under the name: a template's key, a list's group. */
  detail?: ReactNode;
};

/**
 * One of many, picked from a list that can be searched: a Mail template, a
 * mailing list. Native radios in a fieldset, so the arrow keys move between
 * them and a screen reader hears the group; the chosen one stays in view
 * whatever the search. With an error, the radios are marked invalid, so the
 * form can take the sender to the first of them.
 */
export function ChoiceList<T extends { id: string }>({
  legend,
  items,
  value,
  onChange,
  searchLabel,
  searchText,
  choice,
  empty,
  error,
}: {
  legend: string;
  items: readonly T[];
  value: string | null;
  onChange: (id: string) => void;
  searchLabel: string;
  /** What a search matches in an item. */
  searchText: (item: T) => string;
  choice: (item: T) => Choice;
  /** Said when there is nothing to pick at all. */
  empty: string;
  error?: string | null;
}) {
  const name = useId();
  const errorId = useId();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase('tr-TR');
  const shown = needle
    ? items.filter((item) => item.id === value || searchText(item).toLocaleLowerCase('tr-TR').includes(needle))
    : items;

  return (
    <fieldset className="min-w-0 space-y-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-xs font-medium text-neutral-300">{legend}</legend>
      {items.length === 0 ? (
        <p className="rounded-lg border border-white/10 px-3 py-4 text-xs text-neutral-500">{empty}</p>
      ) : (
        <>
          {items.length > 6 ? (
            <FormField
              label={searchLabel}
              labelHidden
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchLabel}
              autoComplete="off"
            />
          ) : null}
          <div className={`max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1 ${error ? 'border-red-400/50' : 'border-white/10'}`}>
            {shown.map((item) => (
              <ChoiceRow
                key={item.id}
                group={name}
                value={item.id}
                choice={choice(item)}
                checked={item.id === value}
                onPick={() => onChange(item.id)}
                invalid={Boolean(error)}
              />
            ))}
            {shown.length === 0 ? <p className="px-3 py-3 text-xs text-neutral-500">Aramaya uyan yok.</p> : null}
          </div>
        </>
      )}
      {error ? (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * One radio, the whole row its label. The radio is named by the choice's name
 * alone and described by its tag and detail, so a screen reader says
 * "Sandbox testi, radio" and then the key, not the whole row as one name.
 */
function ChoiceRow({
  group,
  value,
  choice,
  checked,
  onPick,
  invalid,
}: {
  group: string;
  value: string;
  choice: Choice;
  checked: boolean;
  onPick: () => void;
  invalid: boolean;
}) {
  const nameId = useId();
  const tagId = useId();
  const detailId = useId();
  const describedBy = [choice.tag ? tagId : null, choice.detail ? detailId : null].filter(Boolean).join(' ') || undefined;
  return (
    <label className="has-[:checked]:border-skylab-400/50 has-[:checked]:bg-skylab-500/10 has-[:focus-visible]:ring-skylab-400/40 flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-3 py-2 hover:bg-white/[0.03] has-[:focus-visible]:ring-2">
      <input
        type="radio"
        name={group}
        value={value}
        checked={checked}
        onChange={onPick}
        aria-labelledby={nameId}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        className="accent-skylab-400 mt-0.5 shrink-0 focus:outline-none"
      />
      <span className="block min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span id={nameId} className="text-sm break-words text-neutral-100">
            {choice.name}
          </span>
          {choice.tag ? <span id={tagId}>{choice.tag}</span> : null}
        </span>
        {choice.detail ? (
          <span id={detailId} className="text-2xs mt-0.5 block break-all text-neutral-500">
            {choice.detail}
          </span>
        ) : null}
      </span>
    </label>
  );
}
