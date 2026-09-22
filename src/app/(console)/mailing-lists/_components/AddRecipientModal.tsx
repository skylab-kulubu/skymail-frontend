'use client';

import { useId, useState, type FormEvent } from 'react';
import { Field } from '@/components/chrome/Field';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api/errors';
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
  const ids = { name: useId(), email: useId(), nameError: useId(), emailError: useId() };
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
      const added = await addRecipient(api, listId, input);
      await onAdded(added);
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : new ApiError(0, 'network').message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={ids.name} className="block text-xs font-medium text-neutral-300">
          Ad soyad
        </label>
        <Field
          id={ids.name}
          value={input.full_name}
          onChange={(event) => setInput({ ...input, full_name: event.target.value })}
          autoComplete="off"
          aria-invalid={errors.full_name ? true : undefined}
          aria-describedby={errors.full_name ? ids.nameError : undefined}
        />
        {errors.full_name ? (
          <p id={ids.nameError} className="text-xs text-red-300">
            {errors.full_name}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label htmlFor={ids.email} className="block text-xs font-medium text-neutral-300">
          E-posta
        </label>
        <Field
          id={ids.email}
          type="email"
          inputMode="email"
          value={input.email}
          onChange={(event) => setInput({ ...input, email: event.target.value })}
          autoComplete="off"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? ids.emailError : undefined}
        />
        {errors.email ? (
          <p id={ids.emailError} className="text-xs text-red-300">
            {errors.email}
          </p>
        ) : null}
      </div>
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
