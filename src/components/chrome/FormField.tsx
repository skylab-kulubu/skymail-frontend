import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Field, TextArea } from '@/components/chrome/Field';

type Labelling = {
  label: ReactNode;
  /** The label is for a screen reader only: the field's place says what it is (a row of a table, a search). */
  labelHidden?: boolean;
  /** Said under the field and tied to it: why it is asked, what may be a slip. */
  hint?: ReactNode;
  /** The field's own error, shown under it and tied to it for a screen reader. */
  error?: string | null;
};

/** What a control needs from its label: its id, and its hint, error and requiredness for a screen reader. */
type Wiring = {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
};

/** A label, the control it names, and what is said under it, all tied together. */
function Labelled({
  label,
  labelHidden = false,
  hint,
  error,
  required,
  children,
}: Labelling & { required?: boolean; children: (wiring: Wiring) => ReactNode }) {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={labelHidden ? 'min-w-0 space-y-1' : 'min-w-0 space-y-1.5'}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'block text-xs font-medium text-neutral-300'}>
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required ? true : undefined,
      })}
      {hint ? (
        <div id={hintId} className="space-y-0.5 text-xs text-neutral-500">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & Labelling;

/** A labelled Field with what it needs said under it, and its error. */
export function FormField({ label, labelHidden, hint, error, ...input }: FormFieldProps) {
  return (
    <Labelled label={label} labelHidden={labelHidden} hint={hint} error={error} required={input.required}>
      {(wiring) => <Field {...wiring} {...input} />}
    </Labelled>
  );
}

type FormTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Labelling;

/** A labelled TextArea, wired as FormField wires a Field. */
export function FormTextArea({ label, labelHidden, hint, error, ...textarea }: FormTextAreaProps) {
  return (
    <Labelled label={label} labelHidden={labelHidden} hint={hint} error={error} required={textarea.required}>
      {(wiring) => <TextArea {...wiring} {...textarea} />}
    </Labelled>
  );
}
