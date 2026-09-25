'use client';

/**
 * How the editor shows its blocks. A block's settings are edited on the
 * block itself — a button's label and link, an image's address, a section's
 * condition — and what they become in the mail is the house component the
 * render module draws for it (src/lib/mail-render/visual.tsx), which the
 * preview shows. Nothing here chooses a colour or a style for the mail.
 */
import { useId, type ReactNode } from 'react';
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { GitBranch, Image as ImageIcon, MousePointerClick, Trash2 } from 'lucide-react';
import { FilterPills } from '@/components/chrome/FilterPills';
import { FormField } from '@/components/chrome/FormField';
import { Button } from '@/components/ui/Button';
import {
  CLUB_IMAGE_HOST,
  imageAddressProblem,
  imageWidthProblem,
  isVariableName,
  linkAddressProblem,
} from '@/lib/mail-render/visual-document';
import { colors, darkColors } from '../../../emails/theme';
import { VariableField, useVisualEditor } from './VariableField';

/** A block's frame in the editor: what it is, its settings, and a way to take it out. */
function BlockFrame({
  label,
  icon,
  selected,
  editable,
  onRemove,
  children,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  editable: boolean;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <NodeViewWrapper
      role="group"
      aria-label={label}
      contentEditable={false}
      className={`my-3 space-y-3 rounded-lg border bg-white/[0.02] p-3 ${
        selected ? 'border-skylab-400/60 ring-skylab-400/30 ring-2' : 'border-white/10'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
          {icon}
          {label}
        </p>
        {editable ? <RemoveButton label={`${label} bloğunu kaldır`} onRemove={onRemove} /> : null}
      </div>
      {children}
    </NodeViewWrapper>
  );
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Button variant="outlineDanger" onClick={onRemove} aria-label={label} title={label}>
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      Kaldır
    </Button>
  );
}

const LINK_KINDS = [
  { value: 'url', label: 'Adres' },
  { value: 'variable', label: 'Değişken' },
] as const;

export function ButtonView({ node, updateAttributes, deleteNode, editor, selected }: ReactNodeViewProps) {
  const { allow } = useVisualEditor();
  const { label, linkKind, url, variable } = node.attrs as { label: string; linkKind: 'url' | 'variable'; url: string; variable: string };
  const editable = editor.isEditable;
  const toVariable = allow.variables && linkKind === 'variable';
  return (
    <BlockFrame
      label="Buton"
      icon={<MousePointerClick className="h-3.5 w-3.5" aria-hidden />}
      selected={selected}
      editable={editable}
      onRemove={deleteNode}
    >
      <div>
        <span className="border-skylab-400/40 bg-skylab-500/10 text-skylab-300 inline-block max-w-full rounded-xl border px-6 py-2 text-sm font-semibold break-words">
          {label.trim() === '' ? 'Etiket yok' : label}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Etiket"
          value={label}
          onChange={(event) => updateAttributes({ label: event.target.value })}
          disabled={!editable}
          autoComplete="off"
          error={label.trim() === '' ? 'Butonun etiketi boş olamaz.' : null}
        />
        {allow.variables ? (
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-neutral-300">Bağlantı</p>
            {editable ? (
              <FilterPills
                value={linkKind}
                onChange={(kind) => updateAttributes({ linkKind: kind })}
                options={LINK_KINDS}
                ariaLabel="Bağlantı"
              />
            ) : (
              <p className="text-xs text-neutral-400">{toVariable ? 'Değişken' : 'Adres'}</p>
            )}
          </div>
        ) : null}
        <div className="sm:col-span-2">
          {toVariable ? (
            <VariableField
              label="Bağlantının değişkeni"
              value={variable}
              onChange={(name) => updateAttributes({ variable: name })}
              disabled={!editable}
            />
          ) : (
            <FormField
              label="Adres"
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => updateAttributes({ url: event.target.value.trim() })}
              disabled={!editable}
              placeholder="https://"
              autoComplete="off"
              error={editable ? linkAddressProblem(url) : null}
            />
          )}
        </div>
      </div>
      {toVariable && isVariableName(variable) ? (
        <p className="text-xs text-neutral-500">
          Gönderimde {variable} boş gelirse buton hiç görünmez; boş bir bağlantı gitmez.
        </p>
      ) : null}
    </BlockFrame>
  );
}

/** The image on the card of each mail theme, as the mail will show it. */
const IMAGE_SURFACES = [
  { name: 'Açık tema', background: colors.cardBg },
  { name: 'Koyu tema', background: darkColors.cardBg },
] as const;

export function ImageView({ node, updateAttributes, deleteNode, editor, selected }: ReactNodeViewProps) {
  const { src, alt, width } = node.attrs as { src: string; alt: string; width: number | null };
  const editable = editor.isEditable;
  const problem = src === '' ? 'Görselin adresini yaz.' : imageAddressProblem(src);
  const widthProblem = imageWidthProblem(width === null ? undefined : width);
  return (
    <BlockFrame
      label="Görsel"
      icon={<ImageIcon className="h-3.5 w-3.5" aria-hidden />}
      selected={selected}
      editable={editable}
      onRemove={deleteNode}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField
            label="Görsel adresi"
            type="url"
            inputMode="url"
            value={src}
            onChange={(event) => updateAttributes({ src: event.target.value.trim() })}
            disabled={!editable}
            placeholder={`https://${CLUB_IMAGE_HOST}/images/…`}
            autoComplete="off"
            error={editable ? problem : null}
          />
        </div>
        <FormField
          label="Açıklama (alt metin)"
          value={alt}
          onChange={(event) => updateAttributes({ alt: event.target.value })}
          disabled={!editable}
          placeholder="Görsel yüklenmezse görünen metin"
          autoComplete="off"
        />
        <FormField
          label="Genişlik (piksel, boşsa mail genişliği)"
          type="number"
          inputMode="numeric"
          value={width === null ? '' : String(width)}
          onChange={(event) => updateAttributes({ width: event.target.value === '' ? null : Number(event.target.value) })}
          disabled={!editable}
          error={editable && widthProblem ? `${widthProblem}.` : null}
        />
      </div>
      <p className="text-xs text-neutral-500">
        Kulübün CDN&apos;inden ({CLUB_IMAGE_HOST}) bir görsel ya da .png, .jpg, .gif ile biten bir https adresi kullan.
        Saydam zeminli bir PNG seç: beyaz zeminli bir görsel koyu temada beyaz bir dikdörtgen olarak kalır. SVG ve WebP
        kabul edilmez; Gmail ve Outlook göstermez.
      </p>
      {problem === null ? (
        <div className="grid grid-cols-2 gap-2" aria-label="Görsel iki temada" role="group">
          {IMAGE_SURFACES.map(({ name, background }) => (
            <figure key={name} className="min-w-0 space-y-1">
              <div className="rounded-md border border-white/10 p-2" style={{ backgroundColor: background }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the operator's own image, shown as the mail will */}
                <img src={src} alt={alt} referrerPolicy="no-referrer" className="mx-auto max-h-32 max-w-full object-contain" />
              </div>
              <figcaption className="text-center text-[10px] text-neutral-500">{name}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </BlockFrame>
  );
}

export function ConditionalView({ node, updateAttributes, deleteNode, editor, selected }: ReactNodeViewProps) {
  const { variable, when } = node.attrs as { variable: string; when: string };
  const editable = editor.isEditable;
  const whenId = useId();
  const named = isVariableName(variable) ? variable : 'değişken';
  return (
    <NodeViewWrapper
      role="group"
      aria-label="Koşullu bölüm"
      className={`border-skylab-400/40 my-3 rounded-lg border border-dashed ${selected ? 'ring-skylab-400/30 ring-2' : ''}`}
    >
      <div contentEditable={false} className="space-y-2 border-b border-dashed border-white/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            Koşullu bölüm: {when === 'unset' ? `${named} boşsa görünür` : `${named} doluysa görünür`}
          </p>
          {editable ? <RemoveButton label="Koşullu bölümü kaldır" onRemove={deleteNode} /> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <VariableField
            label="Koşulun değişkeni"
            value={variable}
            onChange={(name) => updateAttributes({ variable: name })}
            disabled={!editable}
          />
          <div className="space-y-1.5">
            <label htmlFor={whenId} className="block text-xs font-medium text-neutral-300">
              Ne zaman görünsün
            </label>
            <select
              id={whenId}
              value={when}
              disabled={!editable}
              onChange={(event) => updateAttributes({ when: event.target.value })}
              className="focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-2 text-xs text-neutral-100 focus:outline-none"
            >
              <option value="set">Değişken doluysa</option>
              <option value="unset">Değişken boşsa</option>
            </select>
          </div>
        </div>
      </div>
      <NodeViewContent className="px-3 pb-1" />
    </NodeViewWrapper>
  );
}

export function VariableView({ node }: ReactNodeViewProps) {
  const name = node.attrs.name as string;
  return (
    <NodeViewWrapper
      as="span"
      aria-label={`Değişken ${name}`}
      className="border-skylab-400/40 bg-skylab-500/10 text-skylab-300 mx-px inline-block rounded border px-1 font-mono text-[0.85em] leading-snug"
    >
      {name}
    </NodeViewWrapper>
  );
}
