import { statusSceneVariant, UnavailableScene, type ErrorSceneVariantOf } from '@skylab-kulubu/skylcn-ui';
import { AlertTriangle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api/errors';

const UNAVAILABLE = new Set([502, 503, 504]);

/**
 * The picture over a page's "… yüklenemedi" card: when SkyNotify did not answer (502, 503 or
 * 504, "SkyNotify şu anda yanıt vermiyor") the club's unavailable scene, its time-limit drawing
 * for a 504; the warning icon otherwise. The card keeps its own title and line.
 */
export function loadFailureArt(error: unknown): { icon?: LucideIcon; top?: ReactNode } {
  if (error instanceof ApiError && (UNAVAILABLE.has(error.status) || error.code === 'server.service_unavailable')) {
    const variant = statusSceneVariant('unavailable', error.status) as ErrorSceneVariantOf<'unavailable'> | undefined;
    return { top: <UnavailableScene variant={variant} /> };
  }
  return { icon: AlertTriangle };
}
