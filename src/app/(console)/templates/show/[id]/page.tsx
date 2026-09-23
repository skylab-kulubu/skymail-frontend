import type { Metadata } from 'next';
import { TemplateShow } from '../../_components/editor/TemplateShow';

export const metadata: Metadata = { title: 'Mail template' };

export default async function Page({ params }: PageProps<'/templates/show/[id]'>) {
  const { id } = await params;
  return <TemplateShow id={id} />;
}
