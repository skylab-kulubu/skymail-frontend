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
import {
  IMAGE_WIDTH,
  imageAddressProblem,
  isVariableName,
  linkAddressProblem,
} from '@/lib/mail-render/visual-document';
import { VARIABLE_NAME_RULE, VariableField } from './VariableField';

const inputClass =
  'focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 text-xs text-neutral-100 placeholder:text-neutral-600 focus:bg-white/5 focus:outline-none aria-invalid:border-red-400/60 disabled:opacity-60';

function TextField({
  label,
  value,
  onChange,
  disabled,
  problem,
  type = 'text',
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  problem?: string | null;
  type?: 'text' | 'url' | 'number';
  placeholder?: string;
  inputMode?: 'numeric' | 'url';
}) {
  const id = useId();
  const problemId = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-neutral-300">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={type === 'text'}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? problemId : undefined}
        className={inputClass}
      />
      {problem ? (
        <p id={problemId} className="text-xs text-red-300">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

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
        {editable ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${label} bloğunu kaldır`}
            title="Bloğu kaldır"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </NodeViewWrapper>
  );
}

export function ButtonView({ node, updateAttributes, deleteNode, editor, selected }: ReactNodeViewProps) {
  const { label, linkKind, url, variable } = node.attrs as { label: string; linkKind: string; url: string; variable: string };
  const editable = editor.isEditable;
  const toVariable = linkKind === 'variable';
  const kindId = useId();
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
        <TextField
          label="Etiket"
          value={label}
          onChange={(value) => updateAttributes({ label: value })}
          disabled={!editable}
          problem={label.trim() === '' ? 'Butonun etiketi boş olamaz.' : null}
        />
        <div className="min-w-0 space-y-1.5">
          <p id={kindId} className="text-xs font-medium text-neutral-300">
            Bağlantı
          </p>
          <div role="radiogroup" aria-labelledby={kindId} className="flex flex-wrap gap-1">
            {[
              { kind: 'url', text: 'Adres' },
              { kind: 'variable', text: 'Değişken' },
            ].map(({ kind, text }) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={linkKind === kind}
                disabled={!editable}
                onClick={() => updateAttributes({ linkKind: kind })}
                className={`h-8 rounded-md border px-3 text-xs font-medium ${
                  linkKind === kind
                    ? 'border-skylab-400/60 bg-skylab-500/15 text-skylab-300'
                    : 'border-white/10 text-neutral-300 hover:bg-white/5'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          {toVariable ? (
            <VariableField
              label="Bağlantının değişkeni"
              value={variable}
              onChange={(name) => updateAttributes({ variable: name })}
              disabled={!editable}
            />
          ) : (
            <TextField
              label="Adres"
              type="url"
              inputMode="url"
              value={url}
              onChange={(value) => updateAttributes({ url: value.trim() })}
              disabled={!editable}
              placeholder="https://"
              problem={linkAddressProblem(url)}
            />
          )}
        </div>
      </div>
      {toVariable ? (
        <p className="text-xs text-neutral-500">
          {isVariableName(variable)
            ? `Gönderimde ${variable} boş gelirse buton hiç görünmez; boş bir bağlantı gitmez.`
            : `Bir değişken seç ya da adını yaz. ${VARIABLE_NAME_RULE}`}
        </p>
      ) : null}
    </BlockFrame>
  );
}

export function ImageView({ node, updateAttributes, deleteNode, editor, selected }: ReactNodeViewProps) {
  const { src, alt, width } = node.attrs as { src: string; alt: string; width: number | null };
  const editable = editor.isEditable;
  const problem = src === '' ? null : imageAddressProblem(src);
  const shown = src !== '' && problem === null;
  const widthOk = width === null || (Number.isInteger(width) && width >= IMAGE_WIDTH.min && width <= IMAGE_WIDTH.max);
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
          <TextField
            label="Görsel adresi (PNG ya da JPG)"
            type="url"
            inputMode="url"
            value={src}
            onChange={(value) => updateAttributes({ src: value.trim() })}
            disabled={!editable}
            placeholder="https://cdn.yildizskylab.com/…/afis.png"
            problem={src === '' ? 'Görselin adresini yaz.' : problem}
          />
        </div>
        <TextField
          label="Açıklama (alt metin)"
          value={alt}
          onChange={(value) => updateAttributes({ alt: value })}
          disabled={!editable}
          placeholder="Görsel yüklenmezse görünen metin"
        />
        <TextField
          label="Genişlik (piksel, boşsa mail genişliği)"
          type="number"
          inputMode="numeric"
          value={width === null ? '' : String(width)}
          onChange={(value) => updateAttributes({ width: value === '' ? null : Number(value) })}
          disabled={!editable}
          problem={widthOk ? null : `Genişlik ${IMAGE_WIDTH.min} ile ${IMAGE_WIDTH.max} arasında bir tam sayı olmalı.`}
        />
      </div>
      <p className="text-xs text-neutral-500">
        Saydam zeminli bir PNG kullan: beyaz zeminli bir görsel koyu temada beyaz bir dikdörtgen olarak kalır. SVG kabul
        edilmez; Gmail ve Outlook SVG göstermez.
      </p>
      {shown ? (
        <div className="grid grid-cols-2 gap-2" aria-label="Görsel iki temada" role="group">
          {[
            { name: 'Açık tema', surface: 'bg-[#fbfafc] text-[#6f6579]' },
            { name: 'Koyu tema', surface: 'bg-[#121115] text-[#a3a3a3]' },
          ].map(({ name, surface }) => (
            <figure key={name} className={`min-w-0 rounded-md border border-white/10 p-2 ${surface}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the operator's own image, shown as the mail will */}
              <img src={src} alt={alt} referrerPolicy="no-referrer" className="mx-auto max-h-32 max-w-full object-contain" />
              <figcaption className="mt-1 text-center text-[10px]">{name}</figcaption>
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
          {editable ? (
            <button
              type="button"
              onClick={deleteNode}
              aria-label="Koşullu bölümü kaldır"
              title="Bölümü içindekilerle kaldır"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
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
