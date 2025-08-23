import React, { useState, useRef } from 'react';
import { DashboardWidget, WidgetSize } from '@/hooks/useDashboardLayout';

interface WidgetResizeHandleProps {
  widget: DashboardWidget;
  onResize: (size: WidgetSize) => void;
  gridSnap: boolean;
}

export function WidgetResizeHandle({ widget, onResize, gridSnap }: WidgetResizeHandleProps) {
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
      const newSize = calculateNewSize(widget.widgetSize, deltaX, deltaY, corner, gridSnap);
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
  gridSnap: boolean
): WidgetSize {
  // Parse current size
  const [currentW, currentH] = currentSize.split('x').map(Number);
  
  // Calculate grid units (assuming 200px per unit)
  const gridUnit = 200;
  let newW = currentW;
  let newH = currentH;

  if (corner.includes('e') || corner === 'se') {
    newW = Math.max(1, Math.min(4, currentW + Math.round(deltaX / gridUnit)));
  }
  
  if (corner.includes('s') || corner === 'se') {
    newH = Math.max(1, Math.min(4, currentH + Math.round(deltaY / gridUnit)));
  }

  // Validate size combination
  const validSizes: WidgetSize[] = [
    '1x1', '2x1', '1x2', '2x2', '3x1', '1x3', '3x2', '2x3', '3x3', '4x1', '1x4', '4x2', '2x4'
  ];
  
  const newSizeStr = `${newW}x${newH}` as WidgetSize;
  
  if (validSizes.includes(newSizeStr)) {
    return newSizeStr;
  }
  
  // Fallback to nearest valid size
  const nearest = validSizes.find(size => {
    const [w, h] = size.split('x').map(Number);
    return Math.abs(w - newW) + Math.abs(h - newH) <= 1;
  });
  
  return nearest || currentSize;
}