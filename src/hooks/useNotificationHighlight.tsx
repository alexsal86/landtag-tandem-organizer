import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface NotificationHighlightResult {
  highlightId: string | null;
  isHighlighted: (id: string | number | null | undefined) => boolean;
  highlightRef: (id: string | number | null | undefined) => (element: HTMLElement | null) => void;
}

/**
 * Hook that reads ?highlight=xxx from the URL,
 * provides an isHighlighted(id) function,
 * scrolls to the highlighted element,
 * and clears the highlight after a timeout.
 */
export const useNotificationHighlight = (clearDelayMs = 5000): NotificationHighlightResult => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const scrolledRef = useRef<boolean>(false);

  useEffect(() => {
    if (!highlightId) {
      setActiveHighlightId(null);
      return;
    }

    setActiveHighlightId(highlightId);
    scrolledRef.current = false;

    const timer = window.setTimeout((): void => {
      setActiveHighlightId(null);
      setSearchParams(
        (prev: URLSearchParams): URLSearchParams => {
          const next = new URLSearchParams(prev);
          next.delete('highlight');
          return next;
        },
        { replace: true },
      );
    }, clearDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clearDelayMs, highlightId, setSearchParams]);

  const scrollToHighlight = useCallback((element: HTMLElement | null): void => {
    if (!element || !activeHighlightId || scrolledRef.current) {
      return;
    }

    scrolledRef.current = true;
    requestAnimationFrame((): void => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [activeHighlightId]);

  const isHighlighted = useCallback((id: string | number | null | undefined): boolean => {
    if (activeHighlightId == null || id == null) {
      return false;
    }

    return activeHighlightId === String(id);
  }, [activeHighlightId]);

  const highlightRef = useCallback(
    (id: string | number | null | undefined) => {
      return (element: HTMLElement | null): void => {
        if (!isHighlighted(id)) {
          return;
        }

        scrollToHighlight(element);
      };
    },
    [isHighlighted, scrollToHighlight],
  );

  return {
    highlightId: activeHighlightId,
    isHighlighted,
    highlightRef,
  };
};
