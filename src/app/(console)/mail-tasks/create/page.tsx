import type { Metadata } from 'next';
import { SendForm } from '@/components/sends/compose/SendForm';
import { sectionLabel } from '@/lib/access';

export const metadata: Metadata = { title: sectionLabel('/mail-tasks/create') };

// Today's address for a new send. superadmin links an Event's mailing list
// here as ?mail_list_id=<id>; SendForm reads it and preselects the list.
export default function Page() {
  return <SendForm />;
}
