/**
 * Told whenever the viewer changes a request for approval — submits,
 * decides, answers or resubmits one — so what counts them (the menu's
 * pending badge) reads them again without a page load.
 */
const listeners = new Set<() => void>();

export function onApprovalsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function approvalsChanged(): void {
  for (const listener of [...listeners]) listener();
}
