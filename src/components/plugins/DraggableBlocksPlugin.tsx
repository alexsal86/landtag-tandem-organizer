import React, { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getSelection, $isRangeSelection } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_NORMAL } from 'lexical';
import { GripVertical } from 'lucide-react';

interface DragHandle {
  element: HTMLElement;
  blockElement: HTMLElement;
}

export function DraggableBlocksPlugin() {
  const [editor] = useLexicalComposerContext();
  const [dragHandles, setDragHandles] = useState<DragHandle[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    const updateDragHandles = () => {
      // Remove existing handles
      dragHandles.forEach(handle => {
        if (handle.element.parentNode) {
          handle.element.parentNode.removeChild(handle.element);
        }
      });

      const newHandles: DragHandle[] = [];
      const blockElements = editorElement.querySelectorAll('p, h1, h2, h3, blockquote, ul, ol, pre');

      blockElements.forEach((blockElement) => {
        const htmlElement = blockElement as HTMLElement;
        const rect = htmlElement.getBoundingClientRect();
        const editorRect = editorElement.getBoundingClientRect();

        const handle = document.createElement('div');
        handle.className = 'lexical-drag-handle';
        handle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
        
        handle.style.position = 'absolute';
        handle.style.left = `${rect.left - editorRect.left - 24}px`;
        handle.style.top = `${rect.top - editorRect.top}px`;
        handle.style.width = '20px';
        handle.style.height = '20px';
        handle.style.cursor = 'grab';
        handle.style.display = 'flex';
        handle.style.alignItems = 'center';
        handle.style.justifyContent = 'center';
        handle.style.backgroundColor = 'var(--background)';
        handle.style.border = '1px solid var(--border)';
        handle.style.borderRadius = '4px';
        handle.style.opacity = '0';
        handle.style.transition = 'opacity 0.2s';
        handle.style.zIndex = '10';
        handle.style.color = 'var(--muted-foreground)';

        // Show handle on hover
        htmlElement.addEventListener('mouseenter', () => {
          handle.style.opacity = '1';
        });
        htmlElement.addEventListener('mouseleave', () => {
          if (!isDragging) {
            handle.style.opacity = '0';
          }
        });

        // Drag functionality
        let draggedElement: HTMLElement | null = null;
        let placeholder: HTMLElement | null = null;

        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          setIsDragging(true);
          draggedElement = htmlElement;
          handle.style.cursor = 'grabbing';

          // Create placeholder
          placeholder = document.createElement('div');
          placeholder.className = 'drag-placeholder';
          placeholder.style.height = `${htmlElement.offsetHeight}px`;
          placeholder.style.backgroundColor = 'var(--accent)';
          placeholder.style.opacity = '0.3';
          placeholder.style.margin = '4px 0';
          placeholder.style.borderRadius = '4px';

          const handleMouseMove = (e: MouseEvent) => {
            if (!draggedElement || !placeholder) return;

            const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
            const blockUnderMouse = elementUnderMouse?.closest('p, h1, h2, h3, blockquote, ul, ol, pre');

            if (blockUnderMouse && blockUnderMouse !== draggedElement && editorElement.contains(blockUnderMouse)) {
              const rect = blockUnderMouse.getBoundingClientRect();
              const isAfter = e.clientY > rect.top + rect.height / 2;

              if (isAfter) {
                blockUnderMouse.parentNode?.insertBefore(placeholder, blockUnderMouse.nextSibling);
              } else {
                blockUnderMouse.parentNode?.insertBefore(placeholder, blockUnderMouse);
              }
            }
          };

          const handleMouseUp = () => {
            if (draggedElement && placeholder && placeholder.parentNode) {
              placeholder.parentNode.insertBefore(draggedElement, placeholder);
              placeholder.remove();
            }

            setIsDragging(false);
            handle.style.cursor = 'grab';
            handle.style.opacity = '0';

            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            // Update editor state
            editor.update(() => {
              // Trigger a re-render to update Lexical's internal state
              const root = $getRoot();
              root.markDirty();
            });
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        });

        editorElement.appendChild(handle);
        newHandles.push({ element: handle, blockElement: htmlElement });
      });

      setDragHandles(newHandles);
    };

    const unregister = mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          setTimeout(updateDragHandles, 10);
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      )
    );

    // Initial setup
    setTimeout(updateDragHandles, 100);

    return () => {
      unregister();
      dragHandles.forEach(handle => {
        if (handle.element.parentNode) {
          handle.element.parentNode.removeChild(handle.element);
        }
      });
    };
  }, [editor, isDragging]);

  return null;
}