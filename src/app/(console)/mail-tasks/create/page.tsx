import type { Metadata } from 'next';
import { SendForm } from '@/components/sends/compose/SendForm';

export const metadata: Metadata = { title: 'Yeni gönderim' };

// Today's address for a new send. superadmin links an Event's mailing list
// here as ?mail_list_id=<id>; SendForm reads it and preselects the list.
export default function Page() {
  return <SendForm />;
}
