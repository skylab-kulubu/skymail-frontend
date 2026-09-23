'use client';

import { useEffect, useRef, useState } from 'react';
import type { Rendered, SourceInput } from '@/lib/mail-render';
import { createRenderBridge, type RenderBridge } from './render-bridge';
import { EDITABLE_MODES, type EditableMode, type Renders } from './editor-state';
import { iframeSandbox } from './sandbox-frame';

/** How long typing must pause before a source is rendered again. */
const DEBOUNCE_MS = 400;

/** The page's render bridge: sandbox frames for as long as the page is open, one loading from the start. */
export function useRenderBridge(): RenderBridge | null {
  const [bridge, setBridge] = useState<RenderBridge | null>(null);
  useEffect(() => {
    const created = createRenderBridge({ createFrame: iframeSandbox() });
    created.warm();
    setBridge(created);
    return () => created.dispose();
  }, []);
  return bridge;
}

export type SourceRenders = Readonly<{
  /** The last render of each mode, successful or not. */
  renders: Renders;
  /** The last successful render of each mode, which a preview keeps showing while a newer text fails. */
  good: Readonly<Partial<Record<EditableMode, Rendered & SourceInput>>>;
}>;

/**
 * Renders each source in `wanted` whenever its text changes: at once the
 * first time, then once typing pauses. A mode left out of `wanted` keeps its
 * last render and is not rendered again until it is wanted.
 */
export function useSourceRenders(
  bridge: RenderBridge | null,
  wanted: Readonly<Partial<Record<EditableMode, string>>>,
): SourceRenders {
  const [state, setState] = useState<SourceRenders>({ renders: {}, good: {} });
  const asked = useRef<Partial<Record<EditableMode, string>>>({});
  const wantedKey = JSON.stringify(EDITABLE_MODES.map((mode) => wanted[mode] ?? null));

  useEffect(() => {
    if (!bridge) return;
    const texts = JSON.parse(wantedKey) as (string | null)[];
    const timers: ReturnType<typeof setTimeout>[] = [];
    EDITABLE_MODES.forEach((mode, index) => {
      const source = texts[index];
      if (source === null || asked.current[mode] === source) return;
      const delay = asked.current[mode] === undefined ? 0 : DEBOUNCE_MS;
      timers.push(
        setTimeout(() => {
          asked.current[mode] = source;
          void bridge.render({ mode, source }).then((render) => {
            if (!render) return;
            setState((previous) => ({
              renders: { ...previous.renders, [mode]: render },
              good: render.ok ? { ...previous.good, [mode]: render } : previous.good,
            }));
          });
        }, delay),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [bridge, wantedKey]);

  return state;
}
