import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Field } from '@/components/chrome/Field';

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  /** The label is for a screen reader only: the field's place says what it is (a row of a table, a search). */
  labelHidden?: boolean;
  /** Said under the field and tied to it: why it is asked, what may be a slip. */
  hint?: ReactNode;
  /** The field's own error, shown under it and tied to it for a screen reader. */
  error?: string | null;
};

/** A labelled Field with what it needs said under it, and its error. */
export function FormField({ label, labelHidden = false, hint, error, ...input }: FormFieldProps) {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={labelHidden ? 'min-w-0 space-y-1' : 'min-w-0 space-y-1.5'}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'block text-xs font-medium text-neutral-300'}>
        {label}
      </label>
      <Field id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
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
