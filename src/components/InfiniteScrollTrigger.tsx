import { useEffect, useRef } from "react";

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  loading: boolean;
  hasMore: boolean;
  threshold?: number;
}

export const InfiniteScrollTrigger = ({
  onLoadMore,
  loading,
  hasMore,
  threshold = 0.8
}: InfiniteScrollTriggerProps) => {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      {
        threshold,
        rootMargin: '100px'
      }
    );

    observer.observe(trigger);

    return () => {
      observer.unobserve(trigger);
    };
  }, [onLoadMore, loading, hasMore, threshold]);

  if (!hasMore) return null;

  return <div ref={triggerRef} className="h-1" />;
};