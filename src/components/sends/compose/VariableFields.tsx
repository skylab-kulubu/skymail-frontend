'use client';

import dynamic from 'next/dynamic';
import { useId } from 'react';
import { FormField } from '@/components/chrome/FormField';
import { FREE_BODY_ALLOWANCE } from '@/lib/mail-render/free-body';
import { variableAction } from '@/lib/mail-render/go-template';
import { EMPTY_VISUAL_SOURCE } from '@/lib/mail-render/visual-document';
import type { FieldInput, VariableField } from '@/lib/send-form/fields';
import { enterSends } from './PeopleEditor';

const VisualEditor = dynamic(() => import('@/components/visual-editor/VisualEditor'), {
  ssr: false,
  loading: () => <p className="rounded-lg border border-white/10 p-4 text-xs text-neutral-500">Visual editör yükleniyor…</p>,
});

/** The Visual editor speaks of the announcement it writes. */
const BODY_WORDING = {
  placeholder: 'Duyurunun metnini yaz; başlık, kalın, italik, bağlantı ve listeleri üstteki çubuktan ekle.',
};

/** What the body may hold, said under the editor: the server keeps nothing else. */
function BodyNote() {
  return (
    <p className="border-t border-white/10 px-4 py-2 text-xs leading-relaxed text-neutral-500">
      Gövdede başlık, paragraf, madde ve numaralı liste, kalın, italik ve bağlantı kullanılır; satır içinde alt satıra geçmek için
      Shift+Enter. Sunucu gönderenin yazdığı gövdeden bunların dışındakini düşürür; buton için aşağıdaki buton alanlarını kullan.
    </p>
  );
}

/** A field's name, a mark when it is a Required variable, and the variable it fills. */
function FieldLabel({ field }: { field: VariableField }) {
  return (
    <>
      {field.label}
      {field.required ? (
        <span className="text-red-300" aria-hidden>
          {' '}
          *
        </span>
      ) : null}
      {field.required ? <span className="sr-only"> (Required variable)</span> : null}
      {field.label !== field.name ? <code className="text-2xs ml-2 font-normal text-neutral-500">{variableAction(field.name)}</code> : null}
    </>
  );
}

/** Why a field is asked for and what may be a slip in it, under the field. */
function Hint({ why, warning }: { why: string | null; warning: string | null }) {
  if (!why && !warning) return null;
  return (
    <>
      {why ? <p>{why}</p> : null}
      {warning ? <p className="text-amber-300">{warning}</p> : null}
    </>
  );
}

function RichField({
  field,
  source,
  onChange,
  error,
  warning,
}: {
  field: VariableField;
  source: string | undefined;
  onChange: (source: string) => void;
  error: string | null;
  warning: string | null;
}) {
  const hintId = useId();
  const errorId = useId();
  return (
    <div className="min-w-0 space-y-1.5 md:col-span-2">
      <p className="text-xs font-medium text-neutral-300">
        <FieldLabel field={field} />
      </p>
      <VisualEditor
        value={source ?? EMPTY_VISUAL_SOURCE}
        onChange={onChange}
        label={field.label}
        allow={FREE_BODY_ALLOWANCE}
        wording={BODY_WORDING}
        footer={<BodyNote />}
        describedBy={`${hintId} ${errorId}`}
        invalid={error !== null}
      />
      <div id={hintId} className="space-y-0.5 text-xs text-neutral-500">
        <Hint why={field.why} warning={warning} />
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The fields a send fills in: one per variable of the Mail template it
 * sends, a markup one (free.basic's BodyHtml) in the Visual editor with only
 * what the server's allow-list keeps. Only a Required variable is marked and
 * holds the send back when empty; anything else that may be a slip is said
 * under its field. Enter in a single-line field sends.
 */
export function VariableFields({
  fields,
  input,
  onValue,
  onRich,
  problems,
  warnings,
  onSend,
}: {
  fields: readonly VariableField[];
  input: FieldInput;
  onValue: (name: string, value: string) => void;
  onRich: (name: string, source: string) => void;
  /** Shown once the sender has tried to send. */
  problems: Readonly<Record<string, string>> | null;
  warnings: Readonly<Record<string, string>>;
  onSend: () => void;
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
            warning={warnings[field.name] ?? null}
          />
        ) : (
          <FormField
            key={field.name}
            label={<FieldLabel field={field} />}
            type={field.kind === 'url' ? 'url' : 'text'}
            inputMode={field.kind === 'url' ? 'url' : undefined}
            value={input.values[field.name] ?? ''}
            onChange={(event) => onValue(field.name, event.target.value)}
            onKeyDown={enterSends(onSend)}
            placeholder={field.kind === 'url' ? 'https://' : undefined}
            autoComplete="off"
            hint={field.why || warnings[field.name] ? <Hint why={field.why} warning={warnings[field.name] ?? null} /> : null}
            error={problems?.[field.name] ?? null}
          />
        ),
      )}
    </div>
  );
}
