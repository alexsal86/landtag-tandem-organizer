import React, { useState, useRef, useCallback } from 'react';
import { DashboardWidget, WidgetSize } from '@/hooks/useDashboardLayout';
import { 
  deltaToGridSize, 
  validateWidgetSize, 
  getResponsiveColumns,
  getGridColumns,
  getGridRows 
} from '@/hooks/useDashboardGrid';

interface WidgetResizeHandleProps {
  widget: DashboardWidget;
  onResize: (widgetId: string, newSize: WidgetSize) => void;
  gridSnap?: boolean;
  containerWidth?: number;
}

export function WidgetResizeHandle({ 
  widget, 
  onResize, 
  gridSnap = true, 
  containerWidth = 1200 
}: WidgetResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [previewSize, setPreviewSize] = useState<WidgetSize | null>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const currentCols = getGridColumns(widget.widgetSize);
  const currentRows = getGridRows(widget.widgetSize);
  const maxCols = getResponsiveColumns(containerWidth);

  const handleMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeDirection(direction);
    setStartPos({ x: e.clientX, y: e.clientY });
    setPreviewSize(widget.widgetSize);

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;

      let newWidth = currentCols;
      let newHeight = currentRows;

      if (gridSnap) {
        const { deltaColumns, deltaRows } = deltaToGridSize(deltaX, deltaY, containerWidth);
        
        if (direction.includes('right') || direction.includes('e')) {
          newWidth = Math.max(1, Math.min(maxCols - (widget.position?.x || 0), currentCols + deltaColumns));
        }
        if (direction.includes('bottom') || direction.includes('s')) {
          newHeight = Math.max(1, Math.min(4, currentRows + deltaRows));
        }
      } else {
        // Pixel-based resizing for freeform mode
        const pixelThreshold = 50;
        if (direction.includes('right') || direction.includes('e')) {
          newWidth = Math.max(1, Math.min(maxCols - (widget.position?.x || 0), currentCols + Math.round(deltaX / pixelThreshold)));
        }
        if (direction.includes('bottom') || direction.includes('s')) {
          newHeight = Math.max(1, Math.min(4, currentRows + Math.round(deltaY / pixelThreshold)));
        }
      }

      const validatedSize = validateWidgetSize(widget.widgetSize, newWidth, newHeight, containerWidth);
      setPreviewSize(validatedSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection('');
      
      if (previewSize && previewSize !== widget.widgetSize) {
        onResize(widget.id, previewSize);
      }
      
      setPreviewSize(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [widget, currentCols, currentRows, maxCols, startPos, containerWidth, gridSnap, onResize, previewSize]);

  const displaySize = previewSize || widget.widgetSize;
  const [displayCols, displayRows] = displaySize.split('x').map(Number);

  return (
    <div ref={resizeRef} className="absolute inset-0 pointer-events-none">
      {/* Corner resize handle - bottom-right */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize pointer-events-auto z-50"
        style={{
          background: 'hsl(var(--primary))',
          borderRadius: '50%',
          border: '2px solid hsl(var(--background))',
          transform: 'translate(50%, 50%)',
          opacity: isResizing ? 1 : 0.8,
          boxShadow: '0 2px 8px hsl(var(--primary) / 0.3)',
        }}
        onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
        title="Größe ändern"
      />
      
      {/* Edge resize handles */}
      <div
        className="absolute right-0 top-2 bottom-2 w-2 cursor-e-resize pointer-events-auto z-40"
        style={{
          background: isResizing && resizeDirection.includes('right') 
            ? 'hsl(var(--primary) / 0.3)' : 'transparent',
          borderRadius: '2px',
        }}
        onMouseDown={(e) => handleMouseDown(e, 'right')}
        title="Breite ändern"
      />
      
      <div
        className="absolute bottom-0 left-2 right-2 h-2 cursor-s-resize pointer-events-auto z-40"
        style={{
          background: isResizing && resizeDirection.includes('bottom') 
            ? 'hsl(var(--primary) / 0.3)' : 'transparent',
          borderRadius: '2px',
        }}
        onMouseDown={(e) => handleMouseDown(e, 'bottom')}
        title="Höhe ändern"
      />

      {/* Size preview */}
      {isResizing && (
        <div 
          className="absolute top-2 left-2 px-2 py-1 text-xs font-medium pointer-events-none z-50"
          style={{
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            borderRadius: '4px',
            boxShadow: '0 2px 8px hsl(var(--primary) / 0.3)',
          }}
        >
          {displayCols}×{displayRows}
          {displayCols >= maxCols && (
            <span className="ml-1 text-yellow-300">MAX</span>
          )}
          {displayRows >= 4 && (
            <span className="ml-1 text-yellow-300">MAX</span>
          )}
        </div>
      )}
    </div>
  );
}