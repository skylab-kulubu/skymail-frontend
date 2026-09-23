'use client';

import { useState } from 'react';
import { MailFrame, SchemeToggle, SubjectPreview } from '@/components/mail-preview/MailPreview';
import type { MailScheme } from '@/components/mail-preview/preview-document';
import { valueText, variableChanges } from '@/lib/mail-approvals/edit';
import type { FieldSource, VariableField } from '@/lib/send-form/fields';

type Variables = Readonly<Record<string, unknown>>;

/** A value in a cell: its text, or a dash for none. */
function Value({ value, kind }: { value: unknown; kind: VariableField['kind'] }) {
  const text = valueText(value, kind);
  if (text === null || text === '') return <span className="text-neutral-600">boş</span>;
  return <span className="block max-h-40 overflow-y-auto break-words whitespace-pre-line text-neutral-200">{text}</span>;
}

/**
 * An edit beside what it changed (ticket 20): each variable that differs,
 * before and after, and — where the pinned version can be read — the mail
 * both ways, side by side in the one theme picked above them. Mails are
 * compared as rendered mail, never as markup (ADR-0046); both are filled
 * here from the pinned version, as the send form's preview is, so they
 * differ only by the edit.
 */
export function EditComparison({
  before,
  after,
  fields,
  source,
  recipient,
  labels,
}: {
  before: Variables | null;
  after: Variables | null;
  fields: readonly VariableField[];
  /** The version the request is pinned to; null when it cannot be read. */
  source: FieldSource | null;
  /** Whom the mails read as: the one recipient, or the submitter for a list. */
  recipient: Readonly<{ full_name: string; email: string }>;
  labels: readonly [before: string, after: string];
}) {
  const [scheme, setScheme] = useState<MailScheme>('light');
  const changes = variableChanges(before, after, fields.map((field) => field.name));
  const fieldOf = (name: string) => fields.find((field) => field.name === name);
  const sample = (values: Variables | null) => ({ ...values, FullName: recipient.full_name, Email: recipient.email });

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[32rem] table-fixed text-left text-xs">
          <caption className="sr-only">Değişen değişkenler</caption>
          <thead className="text-2xs text-neutral-500">
            <tr className="border-b border-white/10">
              <th scope="col" className="w-1/4 px-3 py-2 font-medium">
                Değişken
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels[0]}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {labels[1]}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {changes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-neutral-500">
                  Hiçbir değişken değişmedi.
                </td>
              </tr>
            ) : (
              changes.map((change) => {
                const field = fieldOf(change.name);
                const kind = field?.kind ?? 'text';
                return (
                  <tr key={change.name} className="align-top">
                    <th scope="row" className="px-3 py-2 font-medium text-neutral-300">
                      {field?.label ?? change.name}
                      {field && field.label !== field.name ? <code className="text-2xs block font-normal text-neutral-500">{field.name}</code> : null}
                    </th>
                    <td className="px-3 py-2">
                      <Value value={change.before} kind={kind} />
                    </td>
                    <td className="px-3 py-2">
                      <Value value={change.after} kind={kind} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {source ? (
        <>
          <div className="flex justify-end">
            <SchemeToggle value={scheme} onChange={setScheme} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {([
              [labels[0], before],
              [labels[1], after],
            ] as const).map(([label, values]) => (
              <section key={label} aria-label={label} className="min-w-0 space-y-2">
                <h3 className="text-sm font-medium text-neutral-100">{label}</h3>
                <SubjectPreview subject={source.subject} sample={sample(values)} />
                <MailFrame title={label} html={source.html_content} sample={sample(values)} scheme={scheme} className="h-[50vh] min-h-[320px]" />
              </section>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-neutral-500">
          Mailin iki hâlini yan yana görmek için skymail:templates:read rolü gerekiyor; değişen değişkenler yukarıda.
        </p>
      )}
    </div>
  );
}
