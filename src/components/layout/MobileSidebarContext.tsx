'use client';

import { createContext, useContext } from 'react';

export type MobileSidebarContextValue = {
  open: () => void;
  close: () => void;
  /** Mobil yan menü şu anda görünür mü */
  isOpen: boolean;
};

export const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(null);

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}
