'use client';

import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/chrome/FormField';
import { Button } from '@/components/ui/Button';
import { FormActions } from '@/components/ui/FormActions';
import { apiErrorMessage } from '@/lib/api/errors';
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
      setApiError(apiErrorMessage(reason));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
      <FormField
        label="Liste adı"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Örn: Beta kullanıcıları"
        autoComplete="off"
        autoFocus
        error={error}
      />
      {apiError ? <Notice notice={{ tone: 'error', text: apiError }} /> : null}
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
