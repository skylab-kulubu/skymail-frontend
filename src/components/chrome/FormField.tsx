import { useId, type InputHTMLAttributes } from 'react';
import { Field } from '@/components/chrome/Field';

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** The field's own error, shown under it and tied to it for a screen reader. */
  error?: string | null;
};

/** A labelled Field with its error under it. */
export function FormField({ label, error, ...input }: FormFieldProps) {
  const id = useId();
  const errorId = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-neutral-300">
        {label}
      </label>
      <Field
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
