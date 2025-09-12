import React, { useEffect, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import { useYjsProvider } from '../collaboration/YjsProvider';

interface CursorIndicator {
  clientId: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  color: string;
  position: { x: number; y: number };
  selection?: { from: number; to: number };
}

export function AdvancedCursorPlugin() {
  const [editor] = useLexicalComposerContext();
  const { provider } = useYjsProvider();
  const [cursors, setCursors] = useState<CursorIndicator[]>([]);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!provider) return;

    const updateCursors = () => {
      const awarenessStates = Array.from(provider.awareness.getStates().entries());
      const cursorIndicators: CursorIndicator[] = [];

      awarenessStates.forEach(([clientId, state]) => {
        if (clientId === provider.awareness.clientID) return;

        const { cursor, selection, userId, displayName, avatarUrl, user } = state;
        
        if (cursor) {
          cursorIndicators.push({
            clientId,
            userId: userId || user?.name || `user-${clientId}`,
            displayName: displayName || user?.name || `User ${clientId}`,
            avatarUrl: avatarUrl || user?.avatar,
            color: user?.color || `hsl(${(clientId * 137.508) % 360}, 70%, 50%)`,
            position: cursor,
            selection
          });
        }
      });

      setCursors(cursorIndicators);
    };

    provider.awareness.on('update', updateCursors);
    updateCursors();

    return () => {
      provider.awareness.off('update', updateCursors);
    };
  }, [provider]);

  // Track local cursor position
  useEffect(() => {
    if (!provider) return;

    const updateLocalCursor = () => {
      const editorElement = document.querySelector('.editor-input');
      if (!editorElement) return;

      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const editorRect = editorElement.getBoundingClientRect();

            const relativePosition = {
              x: rect.left - editorRect.left,
              y: rect.top - editorRect.top
            };

            provider.awareness.setLocalStateField('cursor', relativePosition);
            provider.awareness.setLocalStateField('selection', {
              from: selection.anchor.offset,
              to: selection.focus.offset
            });
          }
        }
      });
    };

    const handleSelectionChange = () => {
      updateLocalCursor();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [editor, provider]);

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {cursors.map((cursor) => (
        <div key={cursor.clientId} className="absolute">
          {/* Cursor Line */}
          <div
            style={{
              left: cursor.position.x,
              top: cursor.position.y,
              backgroundColor: cursor.color,
            }}
            className="w-0.5 h-5 absolute animate-pulse"
          />
          
          {/* User Label */}
          <div
            style={{
              left: cursor.position.x + 4,
              top: cursor.position.y - 8,
              backgroundColor: cursor.color,
            }}
            className="absolute px-2 py-1 rounded text-xs text-white whitespace-nowrap shadow-lg"
          >
            <div className="flex items-center gap-1">
              {cursor.avatarUrl ? (
                <img
                  src={cursor.avatarUrl}
                  alt={cursor.displayName}
                  className="w-3 h-3 rounded-full"
                />
              ) : (
                <div
                  className="w-3 h-3 rounded-full bg-white/30"
                  style={{ backgroundColor: cursor.color }}
                />
              )}
              <span className="font-medium">{cursor.displayName}</span>
            </div>
          </div>

          {/* Selection Highlight */}
          {cursor.selection && cursor.selection.from !== cursor.selection.to && (
            <div
              style={{
                left: cursor.position.x,
                top: cursor.position.y,
                backgroundColor: cursor.color,
                opacity: 0.2,
              }}
              className="absolute h-5 pointer-events-none"
            />
          )}
        </div>
      ))}
    </div>
  );
}