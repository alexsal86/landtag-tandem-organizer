import React, { useState, useRef } from 'react';
import { DashboardWidget, WidgetSize } from '@/hooks/useDashboardLayout';
import { deltaToGridSize, validateWidgetSize, getGridColumns, getGridRows } from '@/hooks/useDashboardGrid';

interface WidgetResizeHandleProps {
  widget: DashboardWidget;
  onResize: (size: WidgetSize) => void;
  gridSnap: boolean;
  containerWidth?: number;
}

export function WidgetResizeHandle({ widget, onResize, gridSnap, containerWidth = 1200 }: WidgetResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [previewSize, setPreviewSize] = useState<WidgetSize | null>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (event: React.MouseEvent, corner: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    setIsResizing(true);
    setStartPos({ x: event.clientX, y: event.clientY });

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;

      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;

      // Calculate new size based on delta and grid snap
      const newSize = calculateNewSize(widget.widgetSize, deltaX, deltaY, corner, gridSnap, containerWidth);
      setPreviewSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (previewSize) {
        onResize(previewSize);
        setPreviewSize(null);
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div ref={resizeRef} className="absolute inset-0 pointer-events-none">
      {/* Corner Handles */}
      <div
        className="absolute -bottom-2 -right-2 w-4 h-4 bg-primary border-2 border-background rounded-full cursor-se-resize pointer-events-auto hover:scale-110 transition-transform"
        onMouseDown={(e) => handleMouseDown(e, 'se')}
      />
      
      {/* Edge Handles */}
      <div
        className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-2 h-8 bg-primary/80 rounded-full cursor-e-resize pointer-events-auto hover:scale-110 transition-transform"
        onMouseDown={(e) => handleMouseDown(e, 'e')}
      />
      
      <div
        className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-2 w-8 bg-primary/80 rounded-full cursor-s-resize pointer-events-auto hover:scale-110 transition-transform"
        onMouseDown={(e) => handleMouseDown(e, 's')}
      />

      {/* Preview Overlay */}
      {isResizing && previewSize && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-primary border-dashed rounded-lg flex items-center justify-center">
          <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-medium">
            {previewSize}
          </div>
        </div>
      )}

      {/* Size indicator */}
      <div className="absolute -top-6 left-0 bg-background/90 backdrop-blur px-2 py-1 rounded text-xs text-muted-foreground border">
        {previewSize || widget.widgetSize}
      </div>
    </div>
  );
}

function calculateNewSize(
  currentSize: WidgetSize,
  deltaX: number,
  deltaY: number,
  corner: string,
  gridSnap: boolean,
  containerWidth: number
): WidgetSize {
  // Parse current size
  const [currentW, currentH] = currentSize.split('x').map(Number);
  
  // Use responsive grid calculations
  const { deltaColumns, deltaRows } = deltaToGridSize(deltaX, deltaY, containerWidth);
  
  let newW = currentW;
  let newH = currentH;

  if (corner.includes('e') || corner === 'se') {
    newW = currentW + deltaColumns;
  }
  
  if (corner.includes('s') || corner === 'se') {
    newH = currentH + deltaRows;
  }

  // Validate and clamp the new size
  return validateWidgetSize(currentSize, newW, newH, 6, 4);
}