'use client';

import { useEffect, useRef } from 'react';
import { pageToMoveTo } from '@/lib/list-view';

/**
 * Moves a paged view that went past its end — its last row archived, or a
 * stale link — to the last page there is, once the count is known.
 */
export function useLastPage(page: number, lastPage: number | null, moveTo: (page: number) => void): void {
  const moveToRef = useRef(moveTo);
  useEffect(() => {
    moveToRef.current = moveTo;
  });
  useEffect(() => {
    const target = pageToMoveTo(page, lastPage);
    if (target !== null) moveToRef.current(target);
  }, [page, lastPage]);
}
