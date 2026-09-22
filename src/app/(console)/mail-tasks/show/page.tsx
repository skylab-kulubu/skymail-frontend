import { redirect } from 'next/navigation';

// The breadcrumb of a send (/mail-tasks/show/<id>) links here; there is no
// page between the list and a send.
export default function Page() {
  redirect('/mail-tasks');
}
