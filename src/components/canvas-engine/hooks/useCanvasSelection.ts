import { useState } from 'react';

export const useCanvasSelection = () => {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  return {
    selectedElementId,
    setSelectedElementId,
    selectedElementIds,
    setSelectedElementIds,
  };
};
