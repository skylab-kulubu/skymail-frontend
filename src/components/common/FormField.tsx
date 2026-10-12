import { Input, Label, Textarea, type InputProps } from '@skylab-kulubu/skylcn-ui';
import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

// skylcn-ui's Input, Textarea and Label, wired here rather than with skylcn's
// Field: the page's own ids tie the label, the hint and the error to the
// control, the same for an input and a textarea.

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
      <Label htmlFor={id} className={labelHidden ? 'sr-only' : 'block'}>
        {label}
      </Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required ? true : undefined,
      })}
      {hint ? (
        <div id={hintId} className="text-2xs text-subtle-foreground space-y-0.5 leading-relaxed">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-2xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FormFieldProps = InputProps & Labelling;

/** A labelled Input with what it needs said under it, and its error. */
export function FormField({ label, labelHidden, hint, error, ...input }: FormFieldProps) {
  return (
    <Labelled label={label} labelHidden={labelHidden} hint={hint} error={error} required={input.required}>
      {(wiring) => <Input {...wiring} {...input} />}
    </Labelled>
  );
}

type FormTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Labelling;

/** A labelled Textarea, wired as FormField wires an Input. */
export function FormTextArea({ label, labelHidden, hint, error, ...textarea }: FormTextAreaProps) {
  return (
    <Labelled label={label} labelHidden={labelHidden} hint={hint} error={error} required={textarea.required}>
      {(wiring) => <Textarea {...wiring} {...textarea} />}
    </Labelled>
  );
}
