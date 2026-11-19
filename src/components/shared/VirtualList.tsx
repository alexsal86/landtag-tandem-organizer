import { useRef, useMemo, useLayoutEffect, type ReactNode, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function useVirtualRows<T>(
  items: T[],
  getScrollElement: () => HTMLElement | null,
  estimateSize: number,
  getItemKey?: (item: T, index: number) => string | number,
  overscan = 6,
  scrollMargin = 0,
) {
  return useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
    getItemKey: getItemKey ? (index) => getItemKey(items[index]!, index) : undefined,
  });
}

interface VirtualListProps<T> {
  items: T[];
  /** Geschätzte Pixelhöhe pro Zeile. Bei dynamischen Höhen verwendet TanStack measureElement automatisch. */
  estimateSize: number;
  /** Zusätzliche Zeilen vor/nach dem sichtbaren Bereich. Default 8. */
  overscan?: number;
  /** Renderer pro Zeile. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Stabile Key-Funktion für Re-Renders. */
  getItemKey?: (item: T, index: number) => string | number;
  className?: string;
  style?: CSSProperties;
  /** Höhe des Scroll-Containers. Default 100%. */
  height?: string | number;
  scrollToIndex?: number;
}

/**
 * Wiederverwendbarer Virtual-List-Wrapper auf Basis von @tanstack/react-virtual.
 * Nur rendert die sichtbaren Zeilen. Geeignet für Listen > 200 Items.
 *
 * Beispiel:
 *   <VirtualList
 *     items={contacts}
 *     estimateSize={56}
 *     renderItem={(c) => <ContactRow contact={c} />}
 *     getItemKey={(c) => c.id}
 *   />
 */
export function VirtualList<T>({
  items,
  estimateSize,
  overscan = 6,
  renderItem,
  getItemKey,
  className,
  style,
  height = "100%",
  scrollToIndex,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualRows(items, () => parentRef.current, estimateSize, getItemKey, overscan);
  useLayoutEffect(() => {
    if (scrollToIndex !== undefined && scrollToIndex >= 0) {
      rowVirtualizer.scrollToIndex(scrollToIndex, { align: "auto" });
    }
  }, [rowVirtualizer, scrollToIndex]);

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const containerStyle = useMemo<CSSProperties>(
    () => ({ height, overflow: "auto", ...style }),
    [height, style],
  );

  return (
    <div ref={parentRef} className={className} style={containerStyle}>
      <div
        style={{
          height: totalSize,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((vi) => (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={rowVirtualizer.measureElement}
            style={{
              position: "absolute",
              top: vi.start,
              left: 0,
              width: "100%",
            }}
          >
            {renderItem(items[vi.index]!, vi.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
