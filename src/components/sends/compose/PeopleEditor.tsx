'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { FormField } from '@/components/chrome/FormField';
import { Button } from '@/components/ui/Button';
import { formatCount } from '@/lib/sends';
import { parsePeople, type PeopleCheck, type PersonRow } from '@/lib/send-form/audience';

/** A row of the editor: a person, and an id that stays with the row while others come and go. */
export type PersonEntry = PersonRow & Readonly<{ id: string }>;

let lastRow = 0;

/** A new row, empty unless a person is given. */
export function personEntry(person: PersonRow = { name: '', email: '' }): PersonEntry {
  lastRow += 1;
  return { id: `kisi-${lastRow}`, ...person };
}

/** Enter in a single-line field sends, as it did in the old form. */
export const enterSends = (onSend: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
    event.preventDefault();
    onSend();
  }
};

/**
 * Individual people to send to: a name and an address a row, each sent on
 * its own. Many at once can be pasted in — one per line, or a spreadsheet's
 * two columns.
 */
export function PeopleEditor({
  rows,
  onChange,
  check,
  onSend,
}: {
  rows: readonly PersonEntry[];
  onChange: (rows: PersonEntry[]) => void;
  /** What is wrong with the rows, shown once the sender has tried to send; what may be a slip, always. */
  check: { shown: Pick<PeopleCheck, 'rows' | 'none'> | null; warnings: readonly (string | null)[] };
  onSend: () => void;
}) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const pasteId = useId();
  const filled = rows.filter((row) => row.name.trim() !== '' || row.email.trim() !== '').length;
  const set = (id: string, change: Partial<PersonRow>) => onChange(rows.map((row) => (row.id === id ? { ...row, ...change } : row)));
  const none = check.shown?.none ?? false;

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem] gap-2 text-xs font-medium text-neutral-300 sm:grid" aria-hidden>
        <span>Ad soyad</span>
        <span>E-posta</span>
      </div>
      <ol className="space-y-2">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="grid grid-cols-1 gap-2 rounded-lg border border-white/5 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem] sm:border-0 sm:p-0"
          >
            <FormField
              label={`${index + 1}. kişinin adı soyadı`}
              labelHidden
              value={row.name}
              onChange={(event) => set(row.id, { name: event.target.value })}
              onKeyDown={enterSends(onSend)}
              hint={check.warnings[index] ? <span className="text-amber-300">{check.warnings[index]}</span> : null}
              placeholder="Ayşe Yılmaz"
              autoComplete="off"
            />
            <FormField
              label={`${index + 1}. kişinin e-posta adresi`}
              labelHidden
              type="email"
              inputMode="email"
              value={row.email}
              onChange={(event) => set(row.id, { email: event.target.value })}
              onKeyDown={enterSends(onSend)}
              error={check.shown?.rows[index]?.email ?? (none && index === 0 ? 'En az bir kişi ekle.' : null)}
              placeholder="ayse@ornek.com"
              autoComplete="off"
            />
            <Button
              variant="secondary"
              onClick={() => onChange(rows.length === 1 ? [personEntry()] : rows.filter((other) => other.id !== row.id))}
              aria-label={`${index + 1}. kişiyi çıkar`}
              title="Çıkar"
              className="h-8 justify-self-start px-2.5 py-0 sm:w-full"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              <span className="sm:hidden">Çıkar</span>
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => onChange([...rows, personEntry()])} className="h-8 py-0">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Kişi ekle
        </Button>
        <Button variant="secondary" onClick={() => setPasting(!pasting)} className="h-8 py-0">
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
          Toplu ekle
        </Button>
        <span className="text-xs text-neutral-500 tabular-nums" aria-live="polite">
          {filled > 0 ? `${formatCount(filled)} kişi` : ''}
        </span>
      </div>
      {pasting ? (
        <div className="space-y-2 rounded-lg border border-white/10 p-3">
          <label htmlFor={pasteId} className="block text-xs font-medium text-neutral-300">
            Kişileri yapıştır
          </label>
          <p className="text-xs text-neutral-500">
            Her satıra bir kişi: <code>Ayşe Yılmaz &lt;ayse@ornek.com&gt;</code>, yalnız adres ya da bir tablodan ad ve adres sütunları.
          </p>
          <textarea
            id={pasteId}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={4}
            className="focus:border-skylab-400/50 w-full rounded-md border border-white/10 bg-white/3 px-3 py-2 font-mono text-xs text-neutral-100 placeholder:text-neutral-600 focus:bg-white/5 focus:outline-none"
            placeholder={'Ayşe Yılmaz <ayse@ornek.com>\nali@ornek.com'}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outlineBrand"
              disabled={pasted.trim() === ''}
              onClick={() => {
                const kept = rows.filter((row) => row.name.trim() !== '' || row.email.trim() !== '');
                onChange([...kept, ...parsePeople(pasted).map(personEntry)]);
                setPasted('');
                setPasting(false);
              }}
            >
              Listeye ekle
            </Button>
            <Button variant="secondary" onClick={() => setPasting(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
