import { useState, useCallback, useRef, useEffect } from 'react';

const NAV_WIDTH_KEY = 'nav-sidebar-width';
const DEFAULT_WIDTH = 270;
const MIN_WIDTH = 270;
const MAX_WIDTH = 400;

export function useNavWidth() {
  const [width, setWidthState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(NAV_WIDTH_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) return parsed;
      }
    } catch {}
    return DEFAULT_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);

  const setWidth = useCallback((w: number) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));
    widthRef.current = clamped;
    setWidthState(clamped);
  }, []);

  const saveWidth = useCallback(() => {
    try {
      localStorage.setItem(NAV_WIDTH_KEY, String(widthRef.current));
    } catch {}
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = ev.clientX;
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      widthRef.current = clamped;
      setWidthState(clamped);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem(NAV_WIDTH_KEY, String(widthRef.current));
      } catch {}
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  return { width, setWidth, isResizing, startResize, MIN_WIDTH, MAX_WIDTH };
}
