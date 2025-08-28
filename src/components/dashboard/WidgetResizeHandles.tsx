import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WidgetResizeHandlesProps {
  widget: any;
  onResize: (widgetId: string, newSize: string) => void;
  isEditMode: boolean;
}

const WIDGET_SIZES = [
  '1x1', '2x1', '3x1', 
  '1x2', '2x2', '3x2',
  '1x3', '2x3', '3x3'
];

export const WidgetResizeHandles: React.FC<WidgetResizeHandlesProps> = ({
  widget,
  onResize,
  isEditMode,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'se' | 'e' | 's' | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ w: 1, h: 1 });

  if (!isEditMode) return null;

  const getCurrentSize = () => {
    // Add debugging and safety checks
    console.log('Widget object:', widget);
    console.log('Widget size property:', widget.size, typeof widget.size);
    
    // Handle different possible formats for widget.size
    let sizeString = '2x2'; // Default fallback
    
    if (typeof widget.size === 'string' && widget.size.includes('x')) {
      sizeString = widget.size;
    } else if (typeof widget.size === 'object' && widget.size) {
      // Handle case where size might be an object like {width: 2, height: 2}
      sizeString = `${widget.size.width || widget.size.w || 2}x${widget.size.height || widget.size.h || 2}`;
    } else if (widget.widgetSize && typeof widget.widgetSize === 'string') {
      // Check alternative property name
      sizeString = widget.widgetSize;
    }
    
    const [w, h] = sizeString.split('x').map(Number);
    return { w: w || 2, h: h || 2 };
  };

  const handleMouseDown = (e: React.MouseEvent, direction: 'se' | 'e' | 's') => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeDirection(direction);
    startPos.current = { x: e.clientX, y: e.clientY };
    
    const currentSize = getCurrentSize();
    startSize.current = currentSize;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;
      
      // Convert pixel movement to grid units (roughly 150px per grid unit)
      const gridDeltaX = Math.round(deltaX / 150);
      const gridDeltaY = Math.round(deltaY / 150);
      
      let newW = startSize.current.w;
      let newH = startSize.current.h;
      
      if (direction === 'se' || direction === 'e') {
        newW = Math.max(1, Math.min(3, startSize.current.w + gridDeltaX));
      }
      if (direction === 'se' || direction === 's') {
        newH = Math.max(1, Math.min(3, startSize.current.h + gridDeltaY));
      }
      
      const newSize = `${newW}x${newH}`;
      console.log('Attempting to resize to:', newSize, 'from current:', widget.size);
      if (WIDGET_SIZES.includes(newSize)) {
        // Get current size string for comparison
        const currentSizeString = typeof widget.size === 'string' ? widget.size : 
                                 typeof widget.widgetSize === 'string' ? widget.widgetSize : '2x2';
        if (newSize !== currentSizeString) {
          onResize(widget.id, newSize);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const currentSize = getCurrentSize();

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Corner handle (bottom-right) */}
      <div
        className={cn(
          "absolute bottom-1 right-1 w-4 h-4 bg-primary rounded cursor-se-resize pointer-events-auto z-10",
          "hover:bg-primary/80 transition-colors opacity-70 hover:opacity-100",
          isResizing && resizeDirection === 'se' && "bg-primary/80"
        )}
        onMouseDown={(e) => handleMouseDown(e, 'se')}
        title="Größe ändern"
      />
      
      {/* Right edge handle */}
      <div
        className={cn(
          "absolute right-0 top-4 bottom-4 w-2 bg-primary/60 rounded-l cursor-e-resize pointer-events-auto z-10",
          "hover:bg-primary/80 transition-colors opacity-50 hover:opacity-100",
          isResizing && resizeDirection === 'e' && "bg-primary/80"
        )}
        onMouseDown={(e) => handleMouseDown(e, 'e')}
        title="Breite ändern"
      />
      
      {/* Bottom edge handle */}
      <div
        className={cn(
          "absolute bottom-0 left-4 right-4 h-2 bg-primary/60 rounded-t cursor-s-resize pointer-events-auto z-10",
          "hover:bg-primary/80 transition-colors opacity-50 hover:opacity-100",
          isResizing && resizeDirection === 's' && "bg-primary/80"
        )}
        onMouseDown={(e) => handleMouseDown(e, 's')}
        title="Höhe ändern"
      />

      {/* Size indicator */}
      {isResizing && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium z-20">
          {currentSize.w}x{currentSize.h}
        </div>
      )}
    </div>
  );
};