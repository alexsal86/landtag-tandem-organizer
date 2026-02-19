import { useRef, useState } from 'react';

interface ApplyOptions {
  recordHistory?: boolean;
}

export const useCanvasHistory = <T,>(initialElements: T[]) => {
  const [elements, setElements] = useState<T[]>(initialElements);
  const historyPastRef = useRef<T[][]>([]);
  const historyFutureRef = useRef<T[][]>([]);
  const [, setHistoryVersion] = useState(0);

  const bumpHistoryVersion = () => setHistoryVersion((version) => version + 1);

  const pushHistorySnapshot = (snapshot: T[]) => {
    historyPastRef.current.push(snapshot);
    if (historyPastRef.current.length > 100) historyPastRef.current.shift();
    historyFutureRef.current = [];
    bumpHistoryVersion();
  };

  const applyElements = (
    updater: (prev: T[]) => T[],
    options: ApplyOptions = {},
  ) => {
    const { recordHistory = true } = options;
    setElements((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      if (recordHistory) {
        pushHistorySnapshot(prev);
      }
      return next;
    });
  };

  const undo = () => {
    setElements((prev) => {
      const previous = historyPastRef.current.pop();
      if (!previous) return prev;
      historyFutureRef.current.unshift(prev);
      bumpHistoryVersion();
      return previous;
    });
  };

  const redo = () => {
    setElements((prev) => {
      const next = historyFutureRef.current.shift();
      if (!next) return prev;
      historyPastRef.current.push(prev);
      bumpHistoryVersion();
      return next;
    });
  };

  return {
    elements,
    setElements,
    applyElements,
    pushHistorySnapshot,
    undo,
    redo,
    canUndo: historyPastRef.current.length > 0,
    canRedo: historyFutureRef.current.length > 0,
  };
};
