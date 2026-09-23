'use client';

import dynamic from 'next/dynamic';
import { useId } from 'react';
import { Field } from '@/components/chrome/Field';
import { FREE_BODY_ALLOWANCE } from '@/lib/mail-render/free-body';
import { variableAction } from '@/lib/mail-render/go-template';
import { EMPTY_VISUAL_SOURCE } from '@/lib/mail-render/visual-document';
import type { FieldInput, VariableField } from '@/lib/send-form/fields';

const VisualEditor = dynamic(() => import('@/components/visual-editor/VisualEditor'), {
  ssr: false,
  loading: () => <p className="rounded-lg border border-white/10 p-4 text-xs text-neutral-500">Visual editör yükleniyor…</p>,
});

/** The Visual editor speaks of the announcement it writes. */
const BODY_WORDING = {
  placeholder: 'Duyurunun metnini yaz; başlık, kalın, italik, bağlantı ve butonu üstteki çubuktan ekle.',
};

/** What the body may hold, said under the editor: the server keeps nothing else. */
function BodyNote() {
  return (
    <p className="border-t border-white/10 px-4 py-2 text-xs leading-relaxed text-neutral-500">
      Gövdede başlık, paragraf, kalın, italik, bağlantı ve buton kullanılır: sunucu gönderenin yazdığı gövdeden bunların dışındakini
      düşürür. Buton mailde kalın bir bağlantı olarak görünür; değişken ve görsel burada yok.
    </p>
  );
}

/** A field's name, a mark when it is required, and the variable it fills; a label when there is an input to point at. */
function FieldLabel({ field, htmlFor }: { field: VariableField; htmlFor?: string }) {
  const text = (
    <>
      {field.label}
      {field.required ? (
        <span className="text-red-300" aria-hidden>
          {' '}
          *
        </span>
      ) : null}
      {field.required ? <span className="sr-only"> (zorunlu)</span> : null}
    </>
  );
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-neutral-300">
          {text}
        </label>
      ) : (
        <p className="text-xs font-medium text-neutral-300">{text}</p>
      )}
      {field.label !== field.name ? <code className="text-2xs text-neutral-500">{variableAction(field.name)}</code> : null}
    </div>
  );
}

function TextField({
  field,
  value,
  onChange,
  error,
}: {
  field: VariableField;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const id = useId();
  const whyId = useId();
  const errorId = useId();
  const described = [field.why ? whyId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="min-w-0 space-y-1.5">
      <FieldLabel field={field} htmlFor={id} />
      <Field
        id={id}
        type={field.kind === 'url' ? 'url' : 'text'}
        inputMode={field.kind === 'url' ? 'url' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        placeholder={field.kind === 'url' ? 'https://' : undefined}
        autoComplete="off"
      />
      {field.why ? (
        <p id={whyId} className="text-xs text-neutral-500">
          {field.why}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RichField({
  field,
  source,
  onChange,
  error,
  required,
}: {
  field: VariableField;
  source: string | undefined;
  onChange: (source: string) => void;
  error: string | null;
  required: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5 md:col-span-2">
      <FieldLabel field={{ ...field, required: field.required || required }} />
      <VisualEditor
        value={source ?? EMPTY_VISUAL_SOURCE}
        onChange={onChange}
        label={field.label}
        allow={FREE_BODY_ALLOWANCE}
        wording={BODY_WORDING}
        footer={<BodyNote />}
      />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

/**
 * The fields a send fills in: one per variable of the Mail template it
 * sends, a markup one (free.basic's BodyHtml) in the Visual editor with only
 * what the server's allow-list keeps.
 */
export function VariableFields({
  fields,
  input,
  onValue,
  onRich,
  problems,
  require = [],
}: {
  fields: readonly VariableField[];
  input: FieldInput;
  onValue: (name: string, value: string) => void;
  onRich: (name: string, source: string) => void;
  /** Shown once the sender has tried to send. */
  problems: Readonly<Record<string, string>> | null;
  /** Fields the form needs beyond the template's own. */
  require?: readonly string[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) =>
        field.kind === 'rich' ? (
          <RichField
            key={field.name}
            field={field}
            source={input.rich[field.name]}
            onChange={(source) => onRich(field.name, source)}
            error={problems?.[field.name] ?? null}
            required={require.includes(field.name)}
          />
        ) : (
          <TextField
            key={field.name}
            field={field}
            value={input.values[field.name] ?? ''}
            onChange={(value) => onValue(field.name, value)}
            error={problems?.[field.name] ?? null}
          />
        ),
      )}
    </div>
  );
}
