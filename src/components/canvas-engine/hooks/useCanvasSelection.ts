import { useCallback, useState } from 'react';

export const useCanvasSelection = () => {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  const selectOne = useCallback((id: string | null) => {
    setSelectedElementId(id);
    setSelectedElementIds(id ? [id] : []);
  }, []);

  const setSelection = useCallback((ids: string[]) => {
    const nextIds = Array.from(new Set(ids));
    setSelectedElementIds(nextIds);
    setSelectedElementId(nextIds.length ? nextIds[nextIds.length - 1] : null);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedElementId(id);
    setSelectedElementIds((previous) => {
      if (previous.includes(id)) {
        return previous.filter((currentId) => currentId !== id);
      }
      return [...previous, id];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElementId(null);
    setSelectedElementIds([]);
  }, []);

  return {
    selectedElementId,
    primaryId: selectedElementId,
    setSelectedElementId,
    selectedElementIds,
    setSelectedElementIds,
    selectOne,
    setSelection,
    toggleSelect,
    clearSelection,
  };
};
