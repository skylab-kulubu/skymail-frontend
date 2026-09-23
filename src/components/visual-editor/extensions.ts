/**
 * The Visual editor's extensions: the schema (schema.ts) with the React views
 * of its blocks, and a placeholder for an empty document.
 */
import type { Extensions } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { VisualAllowance } from '@/lib/mail-render/visual-document';
import { ButtonView, ConditionalView, ImageView, VariableView } from './BlockViews';
import { ButtonNode, ConditionalNode, ImageNode, VariableNode, visualSchemaExtensions } from './schema';

const WITH_VIEWS = new Map<unknown, Extensions[number]>([
  [VariableNode, VariableNode.extend({ addNodeView: () => ReactNodeViewRenderer(VariableView, { as: 'span' }) })],
  [ButtonNode, ButtonNode.extend({ addNodeView: () => ReactNodeViewRenderer(ButtonView) })],
  [ImageNode, ImageNode.extend({ addNodeView: () => ReactNodeViewRenderer(ImageView) })],
  [ConditionalNode, ConditionalNode.extend({ addNodeView: () => ReactNodeViewRenderer(ConditionalView) })],
]);

export function visualEditorExtensions(allowance: VisualAllowance, placeholder: string): Extensions {
  return [
    ...visualSchemaExtensions(allowance).map((extension) => WITH_VIEWS.get(extension) ?? extension),
    Placeholder.configure({ placeholder }),
  ];
}
