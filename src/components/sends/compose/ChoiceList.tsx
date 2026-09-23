'use client';

import { useId, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Field } from '@/components/chrome/Field';

/**
 * One of many, picked from a list that can be searched: a Mail template, a
 * mailing list. Native radios in a fieldset, so the arrow keys move between
 * them and a screen reader hears the group; the chosen one stays in view
 * whatever the search.
 */
export function ChoiceList<T extends { id: string }>({
  legend,
  items,
  value,
  onChange,
  searchLabel,
  searchText,
  render,
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
  render: (item: T) => ReactNode;
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
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-neutral-500" aria-hidden />
              <Field
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={searchLabel}
                placeholder={searchLabel}
                className="pl-8"
                autoComplete="off"
              />
            </div>
          ) : null}
          <div
            className={`max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1 ${error ? 'border-red-400/50' : 'border-white/10'}`}
          >
            {shown.map((item) => (
              <label
                key={item.id}
                className="has-[:checked]:border-skylab-400/50 has-[:checked]:bg-skylab-500/10 has-[:focus-visible]:ring-skylab-400/40 flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-3 py-2 hover:bg-white/[0.03] has-[:focus-visible]:ring-2"
              >
                <input
                  type="radio"
                  name={name}
                  value={item.id}
                  checked={item.id === value}
                  onChange={() => onChange(item.id)}
                  className="accent-skylab-400 mt-0.5 shrink-0 focus:outline-none"
                />
                <span className="min-w-0 flex-1">{render(item)}</span>
              </label>
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
