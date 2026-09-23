import type { Metadata } from 'next';
import { TemplateEditor } from '../../_components/editor/TemplateEditor';

export const metadata: Metadata = { title: "Mail template'i düzenle" };

export default async function Page({ params, searchParams }: PageProps<'/templates/edit/[id]'>) {
  const { id } = await params;
  const { start } = await searchParams;
  return <TemplateEditor id={id} startVisual={start === 'visual'} />;
}
