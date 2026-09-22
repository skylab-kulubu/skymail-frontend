import type { Metadata } from 'next';
import { MailingListShow } from '../../_components/MailingListShow';

export const metadata: Metadata = { title: 'Mail listesi' };

// superadmin links an Event's list here: /mailing-lists/show/<id>.
export default async function Page({ params }: PageProps<'/mailing-lists/show/[id]'>) {
  const { id } = await params;
  return <MailingListShow id={id} />;
}
