import type { Metadata } from 'next';
import { MailingListEdit } from '../../_components/MailingListEdit';

export const metadata: Metadata = { title: 'Mail listesini düzenle' };

export default async function Page({ params }: PageProps<'/mailing-lists/edit/[id]'>) {
  const { id } = await params;
  return <MailingListEdit id={id} />;
}
