import React from 'react';
import type { ImageElement, TextElement } from '@/components/canvas-engine/types';

interface TextCanvasElementProps {
  element: TextElement;
  scaleX: number;
  scaleY: number;
  isSelected: boolean;
  isEditing: boolean;
  draftValue: string;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>, element: TextElement) => void;
  onDoubleClick: (event: React.MouseEvent<HTMLDivElement>, element: TextElement) => void;
  onDraftChange: (id: string, value: string) => void;
  onCommitEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  ariaLabel: string;
  renderResizeHandles?: (element: TextElement) => React.ReactNode;
}

export const TextCanvasElement: React.FC<TextCanvasElementProps> = ({
  element,
  scaleX,
  scaleY,
  isSelected,
  isEditing,
  draftValue,
  onMouseDown,
  onDoubleClick,
  onDraftChange,
  onCommitEdit,
  onCancelEdit,
  ariaLabel,
  renderResizeHandles,
}) => {
  const hasExplicitWidth = element.width !== undefined && element.width !== null;
  const hasExplicitHeight = element.height !== undefined && element.height !== null;

  return (
    <div
      aria-label={ariaLabel}
      className={`absolute border ${isSelected ? 'border-primary border-dashed bg-primary/5' : 'border-transparent'} ${isEditing ? 'cursor-text' : 'cursor-move'}`}
      style={{
        left: `${element.x * scaleX}px`,
        top: `${element.y * scaleY}px`,
        width: hasExplicitWidth ? `${element.width! * scaleX}px` : 'auto',
        height: hasExplicitHeight ? `${element.height! * scaleY}px` : 'auto',
        whiteSpace: hasExplicitWidth ? 'normal' : 'nowrap',
        overflow: hasExplicitWidth ? 'hidden' : 'visible',
        fontSize: `${(element.fontSize || 12) * (25.4 / 72) * scaleY}px`,
        fontFamily: element.fontFamily || 'Arial',
        fontWeight: element.fontWeight || 'normal',
        fontStyle: element.fontStyle || 'normal',
        textDecoration: element.textDecoration || 'none',
        color: element.color || '#000000',
        lineHeight: `${element.textLineHeight || 1.2}`,
        textAlign: element.textAlign || 'left',
      }}
      onMouseDown={(event) => {
        if (isEditing) {
          event.stopPropagation();
          return;
        }
        onMouseDown(event, element);
      }}
      onDoubleClick={(event) => onDoubleClick(event, element)}
    >
      {isEditing ? (
        <textarea
          className="w-full h-full min-w-[120px] resize-none border-0 bg-transparent p-0 outline-none"
          value={draftValue}
          autoFocus
          onChange={(event) => onDraftChange(element.id, event.target.value)}
          onBlur={() => onCommitEdit(element.id)}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancelEdit(element.id);
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              onCommitEdit(element.id);
            }
          }}
        />
      ) : (element.content || 'Text')}
      {renderResizeHandles?.(element)}
    </div>
  );
};

interface ImageCanvasElementProps {
  element: ImageElement;
  scaleX: number;
  scaleY: number;
  isSelected: boolean;
  ariaLabel: string;
  onMouseDown: (event: React.MouseEvent<HTMLImageElement>, element: ImageElement) => void;
  renderResizeHandles: (element: ImageElement) => React.ReactNode;
}

export const ImageCanvasElement: React.FC<ImageCanvasElementProps> = ({
  element,
  scaleX,
  scaleY,
  isSelected,
  ariaLabel,
  onMouseDown,
  renderResizeHandles,
}) => {
  const imageSrc = element.imageUrl || element.blobUrl;
  if (!imageSrc) return null;

  const elementWidth = (element.width || 50) * scaleX;
  const elementHeight = (element.height || 30) * scaleY;

  return (
    <div
      className="absolute"
      aria-label={ariaLabel}
      style={{
        left: `${element.x * scaleX}px`,
        top: `${element.y * scaleY}px`,
        width: `${elementWidth}px`,
        height: `${elementHeight}px`,
      }}
    >
      <img
        src={imageSrc}
        alt="Header Image"
        className={`w-full h-full object-contain cursor-move border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}
        onMouseDown={(event) => onMouseDown(event, element)}
        draggable={false}
      />
      {renderResizeHandles(element)}
    </div>
  );
};
