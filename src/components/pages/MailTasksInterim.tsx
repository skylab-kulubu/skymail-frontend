'use client';

import { InterimList } from '@/components/pages/InterimList';

type TaskRow = { id: string; created_at: string; mail_list_id: string | null };

const dateTime = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

export function MailTasksInterim() {
  return (
    <InterimList<TaskRow>
      title="Gönderimler"
      description="Gönderilen ve kuyrukta bekleyen mailler."
      path="/mail_tasks"
      columns={[
        {
          key: 'created_at',
          header: 'Oluşturulma',
          render: (value) => (typeof value === 'string' ? dateTime.format(new Date(value)) : '—'),
        },
        { key: 'mail_list_id', header: 'Kitle', render: (value) => (value ? 'Mail listesi' : 'Tek tek kişiler') },
      ]}
    />
  );
}
