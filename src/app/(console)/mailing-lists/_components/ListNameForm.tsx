'use client';

import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/common/FormField';
import { FormActions } from '@/components/common/FormActions';
import { apiErrorMessage } from '@/lib/api/errors';
import { validateListName } from '@/lib/mailing-lists';
import { OutcomeNotice } from '@/components/common/OutcomeNotice';
import { Button } from '@skylab-kulubu/skylcn-ui';
import { NavButton } from '@/components/common/NavButton';

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
      {apiError ? <OutcomeNotice notice={{ tone: 'error', text: apiError }} /> : null}
      <FormActions
        cancel={
          <NavButton variant="outline" href={cancelHref} disabled={saving}>
            İptal
          </NavButton>
        }
        submit={
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? pendingLabel : submitLabel}
          </Button>
        }
      />
    </form>
  );
}
