import type { Metadata } from 'next';
import { TemplateEditor } from '../../_components/editor/TemplateEditor';

export const metadata: Metadata = { title: "Mail template'i düzenle" };

export default async function Page({ params }: PageProps<'/templates/edit/[id]'>) {
  const { id } = await params;
  return <TemplateEditor id={id} />;
}
