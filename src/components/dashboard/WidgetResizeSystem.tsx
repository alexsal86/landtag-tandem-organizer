import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WidgetResizeSystemProps {
  widget: any;
  onResize: (widgetId: string, newSize: string) => void;
  isEditMode: boolean;
  containerWidth: number;
}

const WIDGET_SIZES = [
  '1x1', '2x1', '3x1',
  '1x2', '2x2', '3x2', 
  '1x3', '2x3', '3x3'
];

export const WidgetResizeSystem: React.FC<WidgetResizeSystemProps> = ({
  widget,
  onResize,
  isEditMode,
  containerWidth,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [previewSize, setPreviewSize] = useState<string | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ w: 0, h: 0 });

  const getGridDimensions = (size: string) => {
    const [w, h] = size.split('x').map(Number);
    return { w, h };
  };

  const handleMouseDown = (e: React.MouseEvent, direction: 'se' | 'e' | 's') => {
    if (!isEditMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    
    const { w, h } = getGridDimensions(widget.size);
    startSize.current = { w, h };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;
      
      // Calculate grid units (rough estimation: 200px per grid unit)
      const gridUnit = Math.max(containerWidth / 6, 200);
      const deltaGridX = Math.round(deltaX / gridUnit);
      const deltaGridY = Math.round(deltaY / gridUnit);
      
      let newW = startSize.current.w;
      let newH = startSize.current.h;
      
      if (direction === 'se' || direction === 'e') {
        newW = Math.max(1, Math.min(3, startSize.current.w + deltaGridX));
      }
      if (direction === 'se' || direction === 's') {
        newH = Math.max(1, Math.min(3, startSize.current.h + deltaGridY));
      }
      
      const newSize = `${newW}x${newH}`;
      if (WIDGET_SIZES.includes(newSize)) {
        setPreviewSize(newSize);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (previewSize && previewSize !== widget.size) {
        onResize(widget.id, previewSize);
      }
      setPreviewSize(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isEditMode) return null;

  return (
    <>
      {/* Resize Handles */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner handle (bottom-right) */}
        <div
          className={cn(
            "absolute bottom-0 right-0 w-4 h-4 bg-primary/60 rounded-tl-lg cursor-se-resize pointer-events-auto",
            "hover:bg-primary transition-colors"
          )}
          onMouseDown={(e) => handleMouseDown(e, 'se')}
        />
        
        {/* Edge handles */}
        <div
          className={cn(
            "absolute right-0 top-2 bottom-2 w-2 bg-primary/40 rounded-l cursor-e-resize pointer-events-auto",
            "hover:bg-primary/60 transition-colors"
          )}
          onMouseDown={(e) => handleMouseDown(e, 'e')}
        />
        
        <div
          className={cn(
            "absolute bottom-0 left-2 right-2 h-2 bg-primary/40 rounded-t cursor-s-resize pointer-events-auto",
            "hover:bg-primary/60 transition-colors"
          )}
          onMouseDown={(e) => handleMouseDown(e, 's')}
        />
      </div>

      {/* Size Preview */}
      {isResizing && previewSize && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium z-50">
          {previewSize}
        </div>
      )}
    </>
  );
};