import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook that reads ?highlight=xxx from the URL,
 * provides an isHighlighted(id) function,
 * scrolls to the highlighted element,
 * and clears the highlight after a timeout.
 */
export const useNotificationHighlight = (clearDelayMs = 5000) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const scrolledRef = useRef(false);

  // Set active highlight when URL param changes
  useEffect(() => {
    if (highlightId) {
      setActiveHighlightId(highlightId);
      scrolledRef.current = false;

      // Clear highlight after delay
      const timer = setTimeout(() => {
        setActiveHighlightId(null);
        // Remove highlight param from URL without navigation
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('highlight');
          return next;
        }, { replace: true });
      }, clearDelayMs);

      return () => clearTimeout(timer);
    } else {
      setActiveHighlightId(null);
    }
  }, [highlightId, clearDelayMs, setSearchParams]);

  // Scroll to highlighted element
  const scrollToHighlight = useCallback((element: HTMLElement | null) => {
    if (element && activeHighlightId && !scrolledRef.current) {
      scrolledRef.current = true;
      // Small delay to ensure element is rendered
      requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [activeHighlightId]);

  const isHighlighted = useCallback((id: string) => {
    return activeHighlightId === id;
  }, [activeHighlightId]);

  // Ref callback for the highlighted element
  const highlightRef = useCallback((id: string) => {
    return (element: HTMLElement | null) => {
      if (element && isHighlighted(id)) {
        scrollToHighlight(element);
      }
    };
  }, [isHighlighted, scrollToHighlight]);

  return {
    highlightId: activeHighlightId,
    isHighlighted,
    highlightRef,
  };
};
