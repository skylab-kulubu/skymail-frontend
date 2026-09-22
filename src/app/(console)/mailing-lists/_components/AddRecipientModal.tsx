'use client';

import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/chrome/FormField';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { apiErrorMessage } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import {
  addRecipient,
  validateRecipient,
  type Recipient,
  type RecipientInput,
} from '@/lib/mailing-lists';

const EMPTY: RecipientInput = { full_name: '', email: '' };

export function AddRecipientModal({
  isOpen,
  listId,
  onClose,
  onAdded,
}: {
  isOpen: boolean;
  listId: string;
  onClose: () => void;
  onAdded: (recipient: Recipient) => Promise<void> | void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alıcı ekle">
      {/* Mounted only while open, so every opening starts with an empty form. */}
      {isOpen ? <AddRecipientForm listId={listId} onCancel={onClose} onAdded={onAdded} /> : null}
    </Modal>
  );
}

function AddRecipientForm({
  listId,
  onCancel,
  onAdded,
}: {
  listId: string;
  onCancel: () => void;
  onAdded: (recipient: Recipient) => Promise<void> | void;
}) {
  const api = useApi();
  const [input, setInput] = useState<RecipientInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof RecipientInput, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateRecipient(input);
    setErrors(found);
    setApiError(null);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onAdded(await addRecipient(api, listId, input));
    } catch (error) {
      setApiError(apiErrorMessage(error));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormField
        label="Ad soyad"
        value={input.full_name}
        onChange={(event) => setInput({ ...input, full_name: event.target.value })}
        autoComplete="off"
        error={errors.full_name}
      />
      <FormField
        label="E-posta"
        type="email"
        inputMode="email"
        value={input.email}
        onChange={(event) => setInput({ ...input, email: event.target.value })}
        autoComplete="off"
        error={errors.email}
      />
      <p className="text-xs leading-relaxed text-neutral-500">
        Bu adres SkyMail&apos;de başka bir listede de varsa aynı alıcı eklenir ve adı her listede burada
        yazdığınla güncellenir.
      </p>
      {apiError ? (
        <p role="alert" className="text-sm text-red-300">
          {apiError}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          İptal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Ekleniyor…' : 'Ekle'}
        </Button>
      </div>
    </form>
  );
}
