import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { DashboardWidget, WidgetSize } from '@/hooks/useDashboardLayout';
import { 
  GRID_COLUMNS, 
  GRID_ROW_HEIGHT, 
  GRID_GAP,
  calculateGridUnit,
  pixelToGridPosition,
  getGridColumns,
  getGridRows
} from '@/hooks/useDashboardGrid';

interface ResponsiveGridSystemProps {
  widgets: DashboardWidget[];
  children: React.ReactNode;
  onWidgetDrop?: (widgetId: string, x: number, y: number) => void;
  onDragOver?: (event: React.DragEvent) => void;
  isEditMode?: boolean;
  gridSnap?: boolean;
}

export const ResponsiveGridSystem = forwardRef<HTMLDivElement, ResponsiveGridSystemProps>(({
  widgets,
  children,
  onWidgetDrop,
  onDragOver,
  isEditMode = false,
  gridSnap = true
}, ref) => {
  const [containerWidth, setContainerWidth] = useState(1200);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use the forwarded ref or fallback to local ref
  const gridRef = (ref as React.RefObject<HTMLDivElement>) || containerRef;

  // Update container width on resize
  useEffect(() => {
    const updateContainerWidth = () => {
      if (gridRef.current) {
        setContainerWidth(gridRef.current.offsetWidth);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, [gridRef]);

  // Calculate grid unit based on current container width
  const gridUnit = calculateGridUnit(containerWidth);

  const handleDragOver = (event: React.DragEvent) => {
    if (!isEditMode) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (gridRef.current && draggedWidget) {
      const rect = gridRef.current.getBoundingClientRect();
      const { column, row } = pixelToGridPosition(
        event.clientX - rect.left,
        event.clientY - rect.top,
        containerWidth
      );
      
      setDragPreview({ x: column - 1, y: row - 1 });
    }

    onDragOver?.(event);
  };

  const handleDrop = (event: React.DragEvent) => {
    if (!isEditMode) return;
    event.preventDefault();
    
    const widgetId = event.dataTransfer.getData('text/plain');
    if (!widgetId || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const { column, row } = pixelToGridPosition(
      event.clientX - rect.left,
      event.clientY - rect.top,
      containerWidth
    );

    onWidgetDrop?.(widgetId, column - 1, row - 1);
    setDraggedWidget(null);
    setDragPreview(null);
  };

  const handleDragStart = (event: React.DragEvent, widgetId: string) => {
    if (!isEditMode) return;
    setDraggedWidget(widgetId);
    event.dataTransfer.setData('text/plain', widgetId);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
    setDragPreview(null);
  };

  return (
    <div
      ref={gridRef}
      className={`
        relative min-h-[800px] transition-all duration-200
        ${isEditMode ? 'border-2 border-dashed border-primary/30 rounded-lg p-4' : 'p-2'}
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragStart={(e) => handleDragStart(e, '')}
      onDragEnd={handleDragEnd}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
        gridTemplateRows: `repeat(auto-fit, ${GRID_ROW_HEIGHT}px)`,
        gap: `${GRID_GAP}px`,
        alignContent: 'start',
        backgroundImage: isEditMode && gridSnap ? `
          linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
        ` : 'none',
        backgroundSize: isEditMode && gridSnap ? 
          `${gridUnit + GRID_GAP}px ${GRID_ROW_HEIGHT + GRID_GAP}px` : 'auto'
      }}
    >
      {/* Drop Preview */}
      {isEditMode && dragPreview && draggedWidget && (
        <div
          className="absolute bg-primary/20 border-2 border-primary border-dashed rounded-lg z-50 pointer-events-none"
          style={{
            gridColumn: `${dragPreview.x + 1} / span ${getGridColumns(
              widgets.find(w => w.id === draggedWidget)?.widgetSize || '1x1'
            )}`,
            gridRow: `${dragPreview.y + 1} / span ${getGridRows(
              widgets.find(w => w.id === draggedWidget)?.widgetSize || '1x1'
            )}`,
            height: `${getGridRows(
              widgets.find(w => w.id === draggedWidget)?.widgetSize || '1x1'
            ) * GRID_ROW_HEIGHT + (getGridRows(
              widgets.find(w => w.id === draggedWidget)?.widgetSize || '1x1'
            ) - 1) * GRID_GAP}px`
          }}
        />
      )}

      {children}
    </div>
  );
});