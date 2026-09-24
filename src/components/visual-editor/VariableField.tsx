'use client';

import { createContext, useContext, useState } from 'react';
import { Braces } from 'lucide-react';
import { FormField } from '@/components/chrome/FormField';
import { Button } from '@/components/ui/Button';
import { TEMPLATE_BODY_ALLOWANCE, isVariableName, type VisualAllowance } from '@/lib/mail-render/visual-document';

/** What the editor says in the words of where it is mounted; a template's editor names the template. */
export type VisualEditorWording = Readonly<{
  /** The group of variables offered to insert. */
  knownVariables: string;
  /** Said when there are none to offer. */
  noKnownVariables: string;
  /** Shown in an empty document. */
  placeholder: string;
}>;

export const GENERIC_WORDING: VisualEditorWording = {
  knownVariables: 'Bilinen değişkenler',
  noKnownVariables: 'Henüz bilinen bir değişken yok; adını yazarak ekleyebilirsin.',
  placeholder: 'Metni yaz; blokları üstteki çubuktan ekle.',
};

/** What the editor's blocks share: the variables to offer, what the document may use, and the wording. */
export type VisualEditorShared = Readonly<{
  variables: readonly string[];
  allow: VisualAllowance;
  wording: VisualEditorWording;
}>;

export const VisualEditorContext = createContext<VisualEditorShared>({
  variables: [],
  allow: TEMPLATE_BODY_ALLOWANCE,
  wording: GENERIC_WORDING,
});

export const useVisualEditor = () => useContext(VisualEditorContext);

export const VARIABLE_NAME_RULE = 'Harfle ya da _ ile başlar; yalnız harf, rakam ve _ içerir.';

/** What is wrong with a variable name as typed, or null. */
export function variableNameProblem(name: string): string | null {
  if (name === '') return 'Bir değişken seç ya da adını yaz.';
  return isVariableName(name) ? null : `Bu bir değişken adı değil. ${VARIABLE_NAME_RULE}`;
}

/** One variable to pick; `keepFocus` leaves the focus where it is, in the text it goes into. */
function VariableChip({
  name,
  onClick,
  pressed,
  keepFocus,
}: {
  name: string;
  onClick: () => void;
  pressed?: boolean;
  keepFocus?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus ? (event) => event.preventDefault() : undefined}
      onClick={onClick}
      aria-pressed={pressed}
      className={`focus-visible:ring-skylab-400/40 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs break-all focus-visible:ring-2 focus-visible:outline-none ${
        pressed
          ? 'border-skylab-400/60 bg-skylab-500/20 text-skylab-300'
          : 'hover:border-skylab-400/40 border-white/10 bg-white/[0.03] text-neutral-300'
      }`}
    >
      <Braces className="h-3 w-3 shrink-0" aria-hidden />
      {name}
    </button>
  );
}

/**
 * A variable's name: typed, or picked from the ones known. What is typed is
 * kept as typed; the field and the render both say when it is not a name the
 * mailer accepts.
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
  return (
    <div className="min-w-0 space-y-1.5">
      <FormField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        disabled={disabled}
        placeholder="Değişken adı, ör. FirstName"
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        error={disabled ? null : variableNameProblem(value)}
      />
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
  const { variables, wording } = useVisualEditor();
  const [name, setName] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        Değişken gönderimde alıcıya göre dolar; metne <span className="font-mono">{'{{.Ad}}'}</span> olarak girer.
      </p>
      {variables.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={wording.knownVariables}>
          {variables.map((known) => (
            <VariableChip key={known} name={known} onClick={() => onInsert(known)} keepFocus />
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">{wording.noKnownVariables}</p>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (isVariableName(name)) onInsert(name);
        }}
      >
        <div className="min-w-0 flex-1">
          <FormField
            label="Başka bir değişken"
            value={name}
            onChange={(event) => setName(event.target.value.trim())}
            placeholder="ör. EventName"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            error={name === '' ? null : variableNameProblem(name)}
          />
        </div>
        <Button type="submit" variant="outlineBrand" disabled={!isVariableName(name)}>
          Ekle
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Vazgeç
        </Button>
      </form>
    </div>
  );
}
