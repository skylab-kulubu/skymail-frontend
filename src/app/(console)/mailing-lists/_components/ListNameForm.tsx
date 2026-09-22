'use client';

import { useId, useState, type FormEvent } from 'react';
import { Field } from '@/components/chrome/Field';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { ApiError } from '@/lib/api/errors';
import { validateListName } from '@/lib/mailing-lists';
import { Notice } from './Notice';

/** The one field an internal list has: its name. Used to create a list and to rename one. */
export function ListNameForm({
  initialName = '',
  submitLabel,
  pendingLabel,
  cancelHref,
  onSubmit,
}: {
  initialName?: string;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** Resolves when saved (the caller navigates); rejects with the API's error. */
  onSubmit: (name: string) => Promise<void>;
}) {
  const ids = { name: useId(), error: useId() };
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validateListName(name);
    setError(invalid);
    setApiError(null);
    if (invalid) return;
    setSaving(true);
    try {
      await onSubmit(name);
    } catch (reason) {
      setApiError(reason instanceof ApiError ? reason.message : new ApiError(0, 'network').message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={ids.name} className="block text-xs font-medium text-neutral-300">
          Liste adı
        </label>
        <Field
          id={ids.name}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Örn: Beta kullanıcıları"
          autoComplete="off"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.error : undefined}
        />
        {error ? (
          <p id={ids.error} className="text-xs text-red-300">
            {error}
          </p>
        ) : null}
      </div>
      {apiError ? <Notice tone="error">{apiError}</Notice> : null}
      <FormActions
        cancel={
          <Button variant="secondary" href={cancelHref} disabled={saving}>
            İptal
          </Button>
        }
        submit={
          <Button type="submit" disabled={saving}>
            {saving ? pendingLabel : submitLabel}
          </Button>
        }
      />
    </form>
  );
}
