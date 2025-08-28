import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DragDropGridProps {
  children: React.ReactNode;
  onWidgetMove: (widgetId: string, newPosition: { x: number; y: number }) => void;
  isEditMode: boolean;
  gridColumns: number;
  containerWidth: number;
}

export const NativeDragDropGrid: React.FC<DragDropGridProps> = ({
  children,
  onWidgetMove,
  isEditMode,
  gridColumns,
  containerWidth,
}) => {
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const getGridPosition = useCallback((clientX: number, clientY: number) => {
    if (!gridRef.current) return { x: 0, y: 0 };
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Calculate grid cell size
    const cellWidth = (containerWidth - (gridColumns - 1) * 16) / gridColumns; // 16px gap
    const cellHeight = 200; // Standard row height
    
    const gridX = Math.floor(x / (cellWidth + 16));
    const gridY = Math.floor(y / (cellHeight + 16));
    
    return { 
      x: Math.max(0, Math.min(gridColumns - 1, gridX)), 
      y: Math.max(0, gridY) 
    };
  }, [containerWidth, gridColumns]);

  const handleDragStart = useCallback((e: React.DragEvent, widgetId: string) => {
    if (!isEditMode) return;
    
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
    
    // Create custom drag image
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '0.5';
    dragImage.style.transform = 'rotate(5deg)';
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  }, [isEditMode]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isEditMode || !draggedWidget) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const gridPos = getGridPosition(e.clientX, e.clientY);
    setDropTarget(gridPos);
    setDragPreview({ x: e.clientX, y: e.clientY });
  }, [isEditMode, draggedWidget, getGridPosition]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isEditMode || !draggedWidget) return;
    
    e.preventDefault();
    const gridPos = getGridPosition(e.clientX, e.clientY);
    onWidgetMove(draggedWidget, gridPos);
    
    setDraggedWidget(null);
    setDropTarget(null);
    setDragPreview(null);
  }, [isEditMode, draggedWidget, getGridPosition, onWidgetMove]);

  const handleDragEnd = useCallback(() => {
    setDraggedWidget(null);
    setDropTarget(null);
    setDragPreview(null);
  }, []);

  return (
    <div
      ref={gridRef}
      className={cn(
        "relative w-full transition-all duration-200",
        isEditMode && "bg-muted/10 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.1)_1px,_transparent_0)] bg-[size:20px_20px]"
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
        gap: '16px',
        minHeight: '100vh',
      }}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        
        return React.cloneElement(child, {
          ...child.props,
          draggable: isEditMode,
          onDragStart: (e: React.DragEvent) => handleDragStart(e, child.props.widget?.id),
          onDragEnd: handleDragEnd,
          className: cn(
            child.props.className,
            isEditMode && "cursor-move",
            draggedWidget === child.props.widget?.id && "opacity-50 scale-105 rotate-2"
          ),
        });
      })}

      {/* Drop Target Indicator */}
      {dropTarget && isEditMode && draggedWidget && (
        <div
          className="absolute bg-primary/20 border-2 border-primary border-dashed rounded-lg z-40 pointer-events-none"
          style={{
            gridColumn: dropTarget.x + 1,
            gridRow: dropTarget.y + 1,
            width: '100%',
            height: '200px',
          }}
        />
      )}

      {/* Drag Preview */}
      {dragPreview && isEditMode && (
        <div
          className="fixed pointer-events-none z-50 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium"
          style={{
            left: dragPreview.x + 10,
            top: dragPreview.y - 30,
          }}
        >
          Position: {dropTarget?.x || 0}, {dropTarget?.y || 0}
        </div>
      )}
    </div>
  );
};