'use client';

import { createContext, useContext, useId, useState } from 'react';
import { Braces } from 'lucide-react';
import { isVariableName } from '@/lib/mail-render/visual-document';

/** What the editor's blocks share: the variables to offer. */
export type VisualEditorShared = Readonly<{ variables: readonly string[] }>;

export const VisualEditorContext = createContext<VisualEditorShared>({ variables: [] });

export const useVisualEditor = () => useContext(VisualEditorContext);

export const VARIABLE_NAME_RULE = 'Harfle ya da _ ile başlar; yalnız harf, rakam ve _ içerir.';

/** One variable, as the editor shows it; `keepFocus` leaves the focus where it is, in the text it goes into. */
export function VariableChip({
  name,
  onClick,
  pressed,
  keepFocus,
}: {
  name: string;
  onClick?: () => void;
  pressed?: boolean;
  keepFocus?: boolean;
}) {
  const className = `inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs break-all ${
    pressed ? 'border-skylab-400/60 bg-skylab-500/20 text-skylab-300' : 'border-white/10 bg-white/[0.03] text-neutral-300'
  }`;
  if (!onClick) return <span className={className}>{name}</span>;
  return (
    <button
      type="button"
      onMouseDown={keepFocus ? (event) => event.preventDefault() : undefined}
      onClick={onClick}
      aria-pressed={pressed}
      className={`${className} hover:border-skylab-400/40`}
    >
      <Braces className="h-3 w-3 shrink-0" aria-hidden />
      {name}
    </button>
  );
}

/**
 * A variable's name: typed, or picked from the ones the template already
 * knows. What is typed is kept as typed; the render says when it is not a
 * name the mailer accepts, and so does this field.
 */
export function VariableField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}) {
  const { variables } = useVisualEditor();
  const id = useId();
  const invalid = value !== '' && !isVariableName(value);
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-neutral-300">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        disabled={disabled}
        placeholder="Değişken adı, ör. FirstName"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid || value === '' ? true : undefined}
        className="focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 font-mono text-xs text-neutral-100 placeholder:font-sans placeholder:text-neutral-600 focus:bg-white/5 focus:outline-none aria-invalid:border-red-400/60"
      />
      {invalid ? <p className="text-xs text-red-300">Bu bir değişken adı değil. {VARIABLE_NAME_RULE}</p> : null}
      {variables.length > 0 && !disabled ? (
        <div className="flex flex-wrap gap-1" aria-label="Bilinen değişkenler" role="group">
          {variables.map((name) => (
            <VariableChip key={name} name={name} pressed={name === value} onClick={() => onChange(name)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The toolbar's panel for putting a variable into the text: a known one, or a new name. */
export function VariableInsertPanel({ onInsert, onClose }: { onInsert: (name: string) => void; onClose: () => void }) {
  const { variables } = useVisualEditor();
  const [name, setName] = useState('');
  const id = useId();
  const invalid = name !== '' && !isVariableName(name);
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        Değişken gönderimde alıcıya göre dolar; metne <span className="font-mono">{'{{.Ad}}'}</span> olarak girer.
      </p>
      {variables.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bu template'in bildiği değişkenler">
          {variables.map((known) => (
            <VariableChip key={known} name={known} onClick={() => onInsert(known)} keepFocus />
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Bu template henüz değişken kullanmıyor; adını yazarak ekleyebilirsin.</p>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (isVariableName(name)) onInsert(name);
        }}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor={id} className="block text-xs font-medium text-neutral-300">
            Başka bir değişken
          </label>
          <input
            id={id}
            value={name}
            onChange={(event) => setName(event.target.value.trim())}
            placeholder="ör. EventName"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={invalid || undefined}
            className="focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 font-mono text-xs text-neutral-100 placeholder:font-sans placeholder:text-neutral-600 focus:bg-white/5 focus:outline-none aria-invalid:border-red-400/60"
          />
        </div>
        <button
          type="submit"
          disabled={!isVariableName(name)}
          className="border-skylab-400/40 text-skylab-300 hover:bg-skylab-500/10 h-8 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
        >
          Ekle
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-md border border-white/10 px-3 text-xs text-neutral-300 hover:bg-white/5"
        >
          Vazgeç
        </button>
      </form>
      {invalid ? <p className="text-xs text-red-300">Bu bir değişken adı değil. {VARIABLE_NAME_RULE}</p> : null}
    </div>
  );
}
