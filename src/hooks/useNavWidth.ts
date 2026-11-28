import { useState, useCallback, useRef, useEffect } from "react";

const NAV_WIDTH_KEY = "nav-sidebar-width";
export const NAV_MIN_WIDTH = 200;
const DEFAULT_WIDTH = 272;
const MAX_WIDTH = 400;

function readWidth() {
  try {
    const stored = Number(localStorage.getItem(NAV_WIDTH_KEY));
    if (stored >= NAV_MIN_WIDTH && stored <= MAX_WIDTH) return stored;
  } catch { /* Storage may be disabled. */ }
  return DEFAULT_WIDTH;
}

export function useNavWidth() {
  const [width, setWidthState] = useState(readWidth);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  const stopResizing = useRef<(() => void) | null>(null);

  const saveWidth = useCallback(() => {
    try { localStorage.setItem(NAV_WIDTH_KEY, String(widthRef.current)); }
    catch { /* The chosen width remains in memory. */ }
  }, []);

  const updateWidth = useCallback((value: number) => {
    widthRef.current = Math.max(NAV_MIN_WIDTH, Math.min(MAX_WIDTH, value));
    setWidthState(widthRef.current);
  }, []);

  const startResize = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopResizing.current?.();
    setIsResizing(true);

    const previousCursor = document.body.style.cursor;
    const previousSelection = document.body.style.userSelect;
    const onMouseMove = (move: MouseEvent) => updateWidth(move.clientX);
    const stop = () => {
      stopResizing.current = null;
      setIsResizing(false);
      saveWidth();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stop);
      window.removeEventListener("blur", stop);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelection;
    };

    stopResizing.current = stop;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stop);
    window.addEventListener("blur", stop);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [saveWidth, updateWidth]);

  useEffect(() => () => stopResizing.current?.(), []);

  return {
    width, isResizing, startResize, minWidth: NAV_MIN_WIDTH, maxWidth: MAX_WIDTH,
    setWidth: (value: number) => { updateWidth(value); saveWidth(); },
  };
}
