'use client';

import { useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { fallbackProblem } from '@/lib/mail-render/recipient-name';
import { Button } from '@skylab-kulubu/skylcn-ui';

/** What the recipient's name is called where an operator meets it. */
export const RECIPIENT_NAME_LABEL = 'Alıcının adı';

/**
 * Putting the recipient's name into a free announcement (recipient-name.ts):
 * the mailer fills it per recipient; what is typed here goes to a recipient
 * without a name instead, and nothing does when it is left empty.
 */
export function RecipientNamePanel({ onInsert, onClose }: { onInsert: (fallback: string) => void; onClose: () => void }) {
  const [fallback, setFallback] = useState('');
  const problem = fallbackProblem(fallback);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Gönderimde her alıcının adı yazılır. Adı olmayan alıcıya aşağıdaki metin gider; boş bırakılırsa hiçbir şey yazılmaz.
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (problem === null) onInsert(fallback);
        }}
      >
        <div className="min-w-0 flex-1">
          <FormField
            label="Adı olmayan alıcıya"
            value={fallback}
            onChange={(event) => setFallback(event.target.value)}
            placeholder="ör. katılımcı"
            autoComplete="off"
            error={problem}
          />
        </div>
        <Button type="submit" variant="primary" disabled={problem !== null}>
          Ekle
        </Button>
        <Button variant="outline" onClick={onClose}>
          Vazgeç
        </Button>
      </form>
    </div>
  );
}
