import type { Metadata } from 'next';
import { TemplateCreate } from '../_components/editor/TemplateCreate';

export const metadata: Metadata = { title: 'Yeni Mail template' };

export default function Page() {
  return <TemplateCreate />;
}
