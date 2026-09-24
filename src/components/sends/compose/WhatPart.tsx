'use client';

import { FilterPills } from '@/components/chrome/FilterPills';
import { NoticeBox } from '@/components/chrome/Notice';
import { Tag } from '@/components/chrome/Tag';
import { NO_FREE_TEMPLATE } from '@/lib/send-form/send';
import type { MailTemplate } from '@/lib/templates';
import { ChoiceList, type Choice } from './ChoiceList';

export type What = 'template' | 'free';

const WHAT_OPTIONS: ReadonlyArray<{ value: What; label: string }> = [
  { value: 'free', label: 'Serbest duyuru' },
  { value: 'template', label: 'Mail template' },
];

/** A Mail template as the picker says it: by name, with its System tag and key. */
function templateChoice(template: MailTemplate): Choice {
  return {
    name: template.name,
    tag: template.system ? <Tag tone="system">System</Tag> : undefined,
    detail: template.key ? (
      <span className="font-mono">
        <span className="sr-only">Template key: </span>
        {template.key}
      </span>
    ) : undefined,
  };
}

/** What is sent: a free announcement in free.basic's frame, or a Mail template picked by name, key and System tag. */
export function WhatPart({
  what,
  onWhat,
  free,
  choices,
  templateId,
  onTemplate,
  problem,
  draftNote,
}: {
  what: What;
  onWhat: (what: What) => void;
  free: MailTemplate | null;
  choices: readonly MailTemplate[];
  templateId: string | null;
  onTemplate: (id: string) => void;
  problem: string | null;
  /** Said when the template has a draft open: the published version is what goes. */
  draftNote: string | null;
}) {
  return (
    <>
      <FilterPills ariaLabel="Ne gönderilecek" value={what} onChange={onWhat} options={WHAT_OPTIONS} />
      {what === 'free' ? (
        free ? (
          <p className="text-xs text-neutral-500">
            Serbest Gönderim template&apos;inin (<code>{free.key}</code>) yayımlanmış çerçevesiyle gider: konuyu, başlığı ve gövdeyi sen
            yazarsın.
          </p>
        ) : (
          <NoticeBox tone="warning">{NO_FREE_TEMPLATE} Bir Mail template seçebilirsin.</NoticeBox>
        )
      ) : (
        <ChoiceList
          legend="Mail template"
          items={choices}
          value={templateId}
          onChange={onTemplate}
          searchLabel="Template ara"
          searchText={(template) => `${template.name} ${template.key ?? ''}`}
          choice={templateChoice}
          empty="Gönderilebilecek bir Mail template yok."
          error={problem}
        />
      )}
      {draftNote ? <NoticeBox tone="info">{draftNote}</NoticeBox> : null}
    </>
  );
}
