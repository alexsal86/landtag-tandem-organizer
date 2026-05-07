import { useRef, useMemo, type ReactNode, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

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
  overscan = 8,
  renderItem,
  getItemKey,
  className,
  style,
  height = "100%",
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index]!, index)
      : undefined,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const containerStyle = useMemo<CSSProperties>(
    () => ({ height, overflow: "auto", contain: "strict", ...style }),
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
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vi.start}px)`,
            }}
          >
            {renderItem(items[vi.index]!, vi.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
