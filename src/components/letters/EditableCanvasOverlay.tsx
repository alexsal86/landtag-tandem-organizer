import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface EditableCanvasOverlayProps {
  /** Position and size in mm */
  top: number;
  left: number;
  width: number;
  height: number;
  /** Label shown in the edit icon tooltip */
  label: string;
  /** Whether editing is allowed */
  canEdit?: boolean;
  /** Popover content rendered when clicking the edit icon */
  children: React.ReactNode;
  /** Optional className for the wrapper */
  className?: string;
  /** Optional z-index for overlap control */
  zIndex?: number;
}

export const EditableCanvasOverlay: React.FC<EditableCanvasOverlayProps> = ({
  top,
  left,
  width,
  height,
  label,
  canEdit = true,
  children,
  className = '',
  zIndex = 20,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  if (!canEdit) return null;

  return (
    <div
      className={`absolute ${className}`}
      style={{
        top: `${top}mm`,
        left: `${left}mm`,
        width: `${width}mm`,
        height: `${height}mm`,
        zIndex,
        pointerEvents: 'auto',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !isOpen && setIsHovered(false)}
    >
      {/* Hover border */}
      <div
        className="absolute inset-0 rounded transition-all duration-150"
        style={{
          border: isHovered || isOpen ? '1.5px dashed rgba(59, 130, 246, 0.5)' : '1.5px dashed transparent',
          backgroundColor: isHovered || isOpen ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
        }}
      />

      {/* Edit button */}
      {(isHovered || isOpen) && (
        <Popover open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setIsHovered(false);
        }}>
          <PopoverTrigger asChild>
            <button
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors z-30"
              title={`${label} bearbeiten`}
            >
              <Pencil className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-80 z-50" 
            side="right" 
            align="start"
            sideOffset={8}
          >
            <div className="space-y-3">
              <h4 className="font-medium text-sm">{label}</h4>
              {children}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
