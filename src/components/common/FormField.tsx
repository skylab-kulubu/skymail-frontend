import { Field, Input, Textarea, type InputProps } from '@skylab-kulubu/skylcn-ui';
import type { ReactNode, TextareaHTMLAttributes } from 'react';

// skylcn-ui's Field around its Input or Textarea: the field ties its label, the
// hint and the error to the control for a screen reader, and marks the control
// invalid while there is an error.

type Labelling = {
  label: ReactNode;
  /** The label is for a screen reader only: the field's place says what it is (a row of a table, a search). */
  labelHidden?: boolean;
  /** Said under the field and tied to it: why it is asked, what may be a slip. Phrasing content only (it sits in a `<p>`). */
  hint?: ReactNode;
  /** The field's own error, shown under it and tied to it for a screen reader. */
  error?: string | null;
};

/** The field's label: a hidden one stays in the accessibility tree and takes no room. */
function fieldLabel(label: ReactNode, labelHidden: boolean) {
  return labelHidden ? <span className="sr-only">{label}</span> : label;
}

type FormFieldProps = InputProps & Labelling;

/** A labelled Input with what it needs said under it, and its error. */
export function FormField({ label, labelHidden = false, hint, error, ...input }: FormFieldProps) {
  return (
    <Field
      label={fieldLabel(label, labelHidden)}
      description={hint || undefined}
      error={error || undefined}
      className={labelHidden ? 'min-w-0 gap-1' : 'min-w-0'}
    >
      <Input {...input} />
    </Field>
  );
}

type FormTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Labelling;

/** A labelled Textarea, wired as FormField wires an Input. */
export function FormTextArea({ label, labelHidden = false, hint, error, ...textarea }: FormTextAreaProps) {
  return (
    <Field
      label={fieldLabel(label, labelHidden)}
      description={hint || undefined}
      error={error || undefined}
      className={labelHidden ? 'min-w-0 gap-1' : 'min-w-0'}
    >
      <Textarea {...textarea} />
    </Field>
  );
}
