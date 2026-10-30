'use client';

import dynamic from 'next/dynamic';
import { useId, useRef, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { RecipientNamePanel } from '@/components/visual-editor/RecipientNamePanel';
import { FREE_BODY_ALLOWANCE } from '@/lib/mail-render/free-body';
import { variableAction } from '@/lib/mail-render/go-template';
import { recipientNameTag } from '@/lib/mail-render/recipient-name';
import { EMPTY_VISUAL_SOURCE } from '@/lib/mail-render/visual-document';
import type { FieldInput, VariableField } from '@/lib/send-form/fields';
import { Button } from '@skylab-kulubu/skylcn-ui';
import { enterSends } from './PeopleEditor';

const VisualEditor = dynamic(() => import('@/components/visual-editor/VisualEditor'), {
  ssr: false,
  loading: () => <p className="rounded-lg border border-border p-4 text-xs text-subtle-foreground">Visual editör yükleniyor…</p>,
});

/** The Visual editor speaks of the announcement it writes. */
const BODY_WORDING = {
  placeholder: 'Duyurunun metnini yaz; başlık, alt başlık, kalın, italik, bağlantı, liste ve alıntıyı üstteki çubuktan ekle.',
};

/** What the body may hold, said under the editor: the server keeps nothing else. */
function BodyNote() {
  return (
    <p className="border-t border-border px-4 py-2 text-xs leading-relaxed text-subtle-foreground">
      Gövdede başlık, alt başlık, paragraf, madde ve numaralı liste, alıntı, kalın, italik, bağlantı ve alıcının adı kullanılır;
      satır içinde alt satıra geçmek için Shift+Enter. Sunucu gönderenin yazdığı gövdeden bunların dışındakini düşürür; buton için
      aşağıdaki buton alanlarını kullan.
    </p>
  );
}

/** A field's name, a mark when it is a Required variable, and the variable it fills. */
function FieldLabel({ field }: { field: VariableField }) {
  return (
    <>
      {field.label}
      {field.required ? (
        <span className="text-destructive" aria-hidden>
          {' '}
          *
        </span>
      ) : null}
      {field.required ? <span className="sr-only"> (Required variable)</span> : null}
      {field.label !== field.name ? <code className="text-2xs ml-2 font-normal text-subtle-foreground">{variableAction(field.name)}</code> : null}
    </>
  );
}

/** Why a field is asked for and what may be a slip in it, under the field. */
function Hint({ why, warning }: { why: string | null; warning: string | null }) {
  if (!why && !warning) return null;
  return (
    <span className="flex flex-col gap-0.5">
      {why ? <span>{why}</span> : null}
      {warning ? <span className="text-warning">{warning}</span> : null}
    </span>
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
      <p className="text-xs font-medium text-secondary-foreground">
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
      <div id={hintId} className="space-y-0.5 text-xs text-subtle-foreground">
        <Hint why={field.why} warning={warning} />
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A single-line field. One the subject prints in a free announcement may
 * take the recipient's name, put where the cursor was (recipient-name.ts:
 * the mailer fills it in the variables the subject prints).
 */
function TextField({
  field,
  value,
  onChange,
  error,
  warning,
  onSend,
  recipientName,
}: {
  field: VariableField;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  warning: string | null;
  onSend?: () => void;
  recipientName: boolean;
}) {
  const [naming, setNaming] = useState(false);
  // Where the cursor last was: the name goes there, or at the end.
  const caret = useRef<number | null>(null);
  const hint =
    field.why || warning || recipientName ? (
      <span className="flex flex-col items-start gap-1">
        <Hint why={field.why} warning={warning} />
        {recipientName && !naming ? (
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setNaming(true)}>
            Alıcının adını ekle
          </Button>
        ) : null}
      </span>
    ) : null;
  return (
    <div className="min-w-0 space-y-2">
      <FormField
        label={<FieldLabel field={field} />}
        type={field.kind === 'url' ? 'url' : 'text'}
        inputMode={field.kind === 'url' ? 'url' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onSelect={(event) => {
          caret.current = event.currentTarget.selectionStart;
        }}
        onKeyDown={onSend ? enterSends(onSend) : undefined}
        placeholder={field.kind === 'url' ? 'https://' : undefined}
        autoComplete="off"
        hint={hint}
        error={error}
      />
      {naming ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <RecipientNamePanel
            onInsert={(fallback) => {
              const at = Math.min(caret.current ?? value.length, value.length);
              onChange(value.slice(0, at) + recipientNameTag(fallback) + value.slice(at));
              setNaming(false);
            }}
            onClose={() => setNaming(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The fields a send fills in: one per variable of the Mail template it
 * sends, a markup one (free.basic's BodyHtml) in the Visual editor with only
 * what the server's allow-list keeps. Only a Required variable is marked and
 * holds the send back when empty; anything else that may be a slip is said
 * under its field. Enter in a single-line field sends, where `onSend` is given.
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
  /** What Enter in a single-line field does; nothing when it is not given. */
  onSend?: () => void;
}) {
  // A free announcement (its body is markup) may greet each recipient by name in its subject too.
  const freeBody = fields.some((field) => field.kind === 'rich');
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
          <TextField
            key={field.name}
            field={field}
            value={input.values[field.name] ?? ''}
            onChange={(value) => onValue(field.name, value)}
            error={problems?.[field.name] ?? null}
            warning={warnings[field.name] ?? null}
            onSend={onSend}
            recipientName={freeBody && field.inSubject && field.kind === 'text'}
          />
        ),
      )}
    </div>
  );
}
