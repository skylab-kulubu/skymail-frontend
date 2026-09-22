import type { Metadata } from 'next';
import { MailingListCreate } from '../_components/MailingListCreate';

export const metadata: Metadata = { title: 'Yeni mail listesi' };

// superadmin's applicant roster links here.
export default function Page() {
  return <MailingListCreate />;
}
