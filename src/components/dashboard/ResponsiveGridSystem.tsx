import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import { getResponsiveColumns, GRID_ROW_HEIGHT, GRID_GAP, pixelToGridPosition } from '@/hooks/useDashboardGrid';
import { DashboardWidget } from '@/hooks/useDashboardLayout';
import { GridDebugOverlay } from './GridDebugOverlay';

interface ResponsiveGridSystemProps {
  widgets: DashboardWidget[];
  children: React.ReactNode;
  onWidgetDrop?: (widgetId: string, x: number, y: number) => void;
  onDragOver?: (e: React.DragEvent) => void;
  isEditMode?: boolean;
  gridSnap?: boolean;
}

export const ResponsiveGridSystem = forwardRef<HTMLDivElement, ResponsiveGridSystemProps>(
  ({ widgets, children, onWidgetDrop, onDragOver, isEditMode = false, gridSnap = true }, ref) => {
    const [containerWidth, setContainerWidth] = useState(1200);
    const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
    const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update container width on resize
    useEffect(() => {
      const updateContainerWidth = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          // CSS Grid: use full container width for accurate calculations
          setContainerWidth(rect.width);
        }
      };

      updateContainerWidth();
      
      const resizeObserver = new ResizeObserver(updateContainerWidth);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => resizeObserver.disconnect();
    }, []);

    const gridColumns = getResponsiveColumns(containerWidth);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isEditMode || !gridSnap || !draggedWidget) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const gridPos = pixelToGridPosition(x, y, containerWidth);
      setDragPreview({ x: gridPos.column, y: gridPos.row });

      onDragOver?.(e);
    }, [isEditMode, gridSnap, draggedWidget, containerWidth, onDragOver]);

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedWidget || !onWidgetDrop) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (gridSnap) {
        const gridPos = pixelToGridPosition(x, y, containerWidth);
        onWidgetDrop(draggedWidget, gridPos.column, gridPos.row);
      } else {
        onWidgetDrop(draggedWidget, x, y);
      }

      setDraggedWidget(null);
      setDragPreview(null);
    }, [draggedWidget, onWidgetDrop, gridSnap, containerWidth]);

    const handleDragStart = useCallback((e: React.DragEvent) => {
      const widgetId = e.dataTransfer.getData('text/plain');
      setDraggedWidget(widgetId);
    }, []);

    const handleDragEnd = useCallback(() => {
      setDraggedWidget(null);
      setDragPreview(null);
    }, []);

    // Grid styles
    const gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
      gridTemplateRows: `repeat(auto, ${GRID_ROW_HEIGHT}px)`,
      gap: `${GRID_GAP}px`,
      minHeight: '60vh',
      padding: `${GRID_GAP}px`,
      position: 'relative' as const,
      width: '100%',
    };

    // Pure CSS Grid aligned background pattern
    const gridBackgroundStyle = isEditMode ? {
      backgroundImage: `
        linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px),
        linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)
      `,
      // Direct CSS Grid 1fr alignment - no pixel calculations
      backgroundSize: `calc(100% / ${gridColumns}) ${GRID_ROW_HEIGHT + GRID_GAP}px`,
      backgroundPosition: `0px 0px`,
      // Account for padding and gaps in the container
      backgroundOrigin: 'padding-box',
    } : {};

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        style={{ ...gridStyle, ...gridBackgroundStyle }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={`dashboard-grid transition-all duration-200 ${
          isEditMode ? 'border-2 border-dashed border-primary/20 rounded-lg' : ''
        }`}
      >
        {/* Drag preview */}
        {isEditMode && dragPreview && draggedWidget && (
          <div
            style={{
              gridColumn: `${dragPreview.x + 1} / span 2`,
              gridRow: `${dragPreview.y + 1} / span 2`,
              backgroundColor: 'hsl(var(--primary) / 0.1)',
              border: '2px dashed hsl(var(--primary))',
              borderRadius: '8px',
              pointerEvents: 'none',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="drag-preview"
          >
            <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-medium">
              Drop hier
            </div>
          </div>
        )}
        
        {/* Debug Overlay - temporarily enabled for testing */}
        <GridDebugOverlay 
          containerWidth={containerWidth} 
          isVisible={isEditMode} 
        />
        
        {children}
      </div>
    );
  }
);

ResponsiveGridSystem.displayName = 'ResponsiveGridSystem';