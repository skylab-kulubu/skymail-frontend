const modalLayers: string[] = [];

export function registerModalLayer(id: string): () => void {
  modalLayers.push(id);
  return () => {
    const index = modalLayers.lastIndexOf(id);
    if (index >= 0) modalLayers.splice(index, 1);
  };
}

export function isTopModalLayer(id: string): boolean {
  return modalLayers.at(-1) === id;
}
