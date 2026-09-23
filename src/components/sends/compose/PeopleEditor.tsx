'use client';

import { useId, useState } from 'react';
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { Field } from '@/components/chrome/Field';
import { Button } from '@/components/ui/Button';
import { formatCount } from '@/lib/sends';
import { parsePeople, type PersonRow, type RowProblems } from '@/lib/send-form/audience';

const EMPTY: PersonRow = { name: '', email: '' };

/** One input of a person's row, with its error under it and tied to it. */
function RowField({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'email';
  placeholder: string;
}) {
  const errorId = useId();
  return (
    <div className="min-w-0 space-y-1">
      <Field
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder={placeholder}
        autoComplete="off"
        inputMode={type === 'email' ? 'email' : undefined}
      />
      {error ? (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Individual people to send to: a name and an address a row, each sent on
 * its own. Many at once can be pasted in — one per line, or a spreadsheet's
 * two columns.
 */
export function PeopleEditor({
  rows,
  onChange,
  problems,
  none,
}: {
  rows: readonly PersonRow[];
  onChange: (rows: PersonRow[]) => void;
  /** One entry per row; shown once the sender has tried to send. */
  problems: readonly RowProblems[] | null;
  /** No row names anyone, said once the sender has tried to send. */
  none: boolean;
}) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const pasteId = useId();
  const filled = rows.filter((row) => row.name.trim() !== '' || row.email.trim() !== '').length;
  const set = (index: number, change: Partial<PersonRow>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...change } : row)));

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-xs font-medium text-neutral-300 sm:grid">
        <span>Ad soyad</span>
        <span>E-posta</span>
        <span className="w-[5.5rem]" aria-hidden />
      </div>
      <ol className="space-y-2">
        {rows.map((row, index) => (
          <li
            key={index}
            className="grid grid-cols-1 gap-2 rounded-lg border border-white/5 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:border-0 sm:p-0"
          >
            <RowField
              label={`${index + 1}. kişinin adı soyadı`}
              value={row.name}
              onChange={(name) => set(index, { name })}
              error={problems?.[index]?.name}
              placeholder="Ayşe Yılmaz"
            />
            <RowField
              label={`${index + 1}. kişinin e-posta adresi`}
              type="email"
              value={row.email}
              onChange={(email) => set(index, { email })}
              error={problems?.[index]?.email}
              placeholder="ayse@ornek.com"
            />
            <Button
              variant="secondary"
              onClick={() => onChange(rows.length === 1 ? [EMPTY] : rows.filter((_, at) => at !== index))}
              aria-label={`${index + 1}. kişiyi çıkar`}
              title="Çıkar"
              className="h-8 justify-self-start px-2.5 py-0 sm:w-[5.5rem]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              <span className="sm:hidden">Çıkar</span>
            </Button>
          </li>
        ))}
      </ol>
      {none ? <p className="text-xs text-red-300">En az bir kişi ekle.</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => onChange([...rows, EMPTY])} className="h-8 py-0">
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
                onChange([...kept, ...parsePeople(pasted)]);
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
