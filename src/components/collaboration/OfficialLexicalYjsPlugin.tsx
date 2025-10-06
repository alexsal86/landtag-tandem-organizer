import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useYjsProvider } from './YjsProvider';
import * as Y from 'yjs';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';

interface OfficialLexicalYjsPluginProps {
  id: string;
  shouldBootstrap?: boolean;
}

/**
 * Simplified Lexical Yjs Plugin
 * Manually syncs between Lexical and Yjs using granular text operations
 * Avoids focus loss by using character-level diffs instead of clearing
 */
export function OfficialLexicalYjsPlugin({
  id,
  shouldBootstrap = true,
}: OfficialLexicalYjsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const yjsContext = useYjsProvider();
  const isApplyingYjsUpdateRef = useRef(false);
  const isApplyingLexicalUpdateRef = useRef(false);
  const lastContentRef = useRef('');

  useEffect(() => {
    // Wait for Yjs provider to be ready
    if (!yjsContext.doc || !yjsContext.provider || !yjsContext.isSynced) {
      return;
    }

    const doc = yjsContext.doc;
    const sharedText = doc.getText('lexical-content');
    const clientId = yjsContext.clientId;

    console.log('[OfficialLexicalYjs] Initializing with clientId:', clientId);

    // Bootstrap initial content from Yjs
    if (shouldBootstrap && sharedText.length > 0) {
      const initialText = sharedText.toString();
      console.log('[OfficialLexicalYjs] Bootstrapping from Yjs:', initialText.slice(0, 100));
      
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        if (initialText) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(initialText));
          root.append(paragraph);
        }
        lastContentRef.current = initialText;
      });
    }

    // Listen to Yjs changes (from remote)
    const yjsObserver = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      // Skip if this is our own update (echo prevention)
      if (transaction.origin === clientId) {
        console.log(`[OfficialLexicalYjs:${clientId}] ⏭️  Skipping own Yjs update`);
        return;
      }

      // Skip if we're currently applying a Lexical update
      if (isApplyingLexicalUpdateRef.current) {
        console.log(`[OfficialLexicalYjs:${clientId}] ⏭️  Skipping (Lexical update in progress)`);
        return;
      }

      const newText = sharedText.toString();
      
      // Only apply if content actually changed
      if (newText === lastContentRef.current) {
        return;
      }

      console.log(`[OfficialLexicalYjs:${clientId}] 📥 Applying remote Yjs change`);
      
      isApplyingYjsUpdateRef.current = true;
      
      try {
        editor.update(() => {
          const root = $getRoot();
          const currentText = root.getTextContent();
          
          // Only update if different
          if (currentText !== newText) {
            root.clear();
            if (newText) {
              const paragraph = $createParagraphNode();
              paragraph.append($createTextNode(newText));
              root.append(paragraph);
            }
            lastContentRef.current = newText;
          }
        });
      } finally {
        isApplyingYjsUpdateRef.current = false;
      }
    };

    sharedText.observe(yjsObserver);

    // Listen to Lexical changes (local)
    const unregisterUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      // Skip if we're applying a Yjs update
      if (isApplyingYjsUpdateRef.current) {
        return;
      }

      // Skip if we're already applying a Lexical update
      if (isApplyingLexicalUpdateRef.current) {
        return;
      }

      editorState.read(() => {
        const root = $getRoot();
        const text = root.getTextContent();

        // Only push if content changed
        if (text !== lastContentRef.current) {
          console.log(`[OfficialLexicalYjs:${clientId}] 📝 Lexical changed, pushing to Yjs`);
          
          isApplyingLexicalUpdateRef.current = true;
          
          try {
            doc.transact(() => {
              const currentYjsText = sharedText.toString();
              
              // Calculate diff for granular updates
              let deleteStart = 0;
              const minLength = Math.min(text.length, currentYjsText.length);
              
              // Find common prefix
              while (deleteStart < minLength && text[deleteStart] === currentYjsText[deleteStart]) {
                deleteStart++;
              }
              
              // Find common suffix
              let textEnd = text.length;
              let yjsEnd = currentYjsText.length;
              while (textEnd > deleteStart && yjsEnd > deleteStart && text[textEnd - 1] === currentYjsText[yjsEnd - 1]) {
                textEnd--;
                yjsEnd--;
              }
              
              const deleteLength = yjsEnd - deleteStart;
              const insertText = text.slice(deleteStart, textEnd);
              
              // Apply granular changes
              if (deleteLength > 0) {
                sharedText.delete(deleteStart, deleteLength);
              }
              if (insertText.length > 0) {
                sharedText.insert(deleteStart, insertText);
              }
              
              console.log(`[OfficialLexicalYjs:${clientId}] ✅ Granular update: delete ${deleteLength}, insert ${insertText.length} at ${deleteStart}`);
            }, clientId); // Use clientId as transaction origin for echo prevention
            
            lastContentRef.current = text;
          } finally {
            isApplyingLexicalUpdateRef.current = false;
          }
        }
      });
    });

    // Cleanup
    return () => {
      console.log('[OfficialLexicalYjs] Cleaning up');
      sharedText.unobserve(yjsObserver);
      unregisterUpdateListener();
    };
  }, [editor, yjsContext.doc, yjsContext.provider, yjsContext.isSynced, yjsContext.clientId, shouldBootstrap]);

  // Show loading overlay while not synced
  if (!yjsContext.isSynced || !yjsContext.isConnected) {
    return (
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center pointer-events-none">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          {!yjsContext.isConnected ? 'Connecting...' : 'Syncing...'}
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Collaborator UI Component
 * Displays online collaborators from Yjs awareness
 */
export function YjsCollaboratorsList() {
  const yjsContext = useYjsProvider();

  if (!yjsContext.collaborators || yjsContext.collaborators.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
      <span className="text-xs font-medium text-muted-foreground">
        {yjsContext.collaborators.length} other{yjsContext.collaborators.length !== 1 ? 's' : ''} online:
      </span>
      <div className="flex items-center gap-1">
        {yjsContext.collaborators.map((collaborator: any) => (
          <div
            key={collaborator.user_id}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ 
              backgroundColor: collaborator.user_color ? `${collaborator.user_color}20` : undefined,
              borderLeft: `3px solid ${collaborator.user_color || '#888'}` 
            }}
          >
            {collaborator.profiles?.avatar_url && (
              <img 
                src={collaborator.profiles.avatar_url} 
                alt={collaborator.profiles?.display_name || 'User'}
                className="w-4 h-4 rounded-full"
              />
            )}
            <span className="font-medium">
              {collaborator.profiles?.display_name || 'User'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
