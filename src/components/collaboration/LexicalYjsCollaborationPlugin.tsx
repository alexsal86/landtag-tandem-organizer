import React, { useEffect, useRef, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { useYjsProvider } from './YjsProvider';

interface LexicalYjsCollaborationPluginProps {
  id: string;
  shouldBootstrap?: boolean;
}

export function LexicalYjsCollaborationPlugin({ 
  id, 
  shouldBootstrap = true 
}: LexicalYjsCollaborationPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { doc, isSynced, provider } = useYjsProvider();
  const lastContentRef = useRef<string>('');
  const isApplyingYjsUpdateRef = useRef<boolean>(false);
  const isApplyingLexicalUpdateRef = useRef<boolean>(false);
  const hasBootstrapped = useRef<boolean>(false);
  const clientId = useRef<string>(`client-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!doc || !editor || !isSynced) return;

    console.log('[LexicalYjsCollaboration] Setting up improved plaintext Yjs binding for:', id);

    // Use a consistent Yjs key name
    const sharedText = doc.getText('content');

    const applyYjsToLexical = useCallback((origin?: any, transactionOrigin?: string) => {
      // Prevent echo: skip if this update originated from our own Lexical editor
      const isOwnUpdate = origin === 'lexical' || transactionOrigin === clientId.current;
      
      if (isOwnUpdate) {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Skipping echo - origin:`, origin, 'transaction:', transactionOrigin);
        return;
      }
      
      const content = sharedText.toString();
      
      // Skip if we're already applying a Yjs update or content hasn't changed
      if (isApplyingYjsUpdateRef.current || content === lastContentRef.current) {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Skipping - applying:${isApplyingYjsUpdateRef.current}, unchanged:${content === lastContentRef.current}`);
        return;
      }

      console.log(`[LexicalYjsCollaboration:${clientId.current}] Applying Yjs content to Lexical:`, {
        origin,
        transactionOrigin,
        contentLength: content.length,
        preview: content.slice(0, 50)
      });
      
      isApplyingYjsUpdateRef.current = true;
      
      try {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          
          if (content.trim()) {
            // Split content by newlines and create paragraphs
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              const p = $createParagraphNode();
              if (line.trim()) {
                p.append($createTextNode(line));
              }
              root.append(p);
            });
          } else {
            // Empty content - add single empty paragraph
            const p = $createParagraphNode();
            root.append(p);
          }
          
          // Update ref synchronously within the update
          lastContentRef.current = content;
        });
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error applying Yjs content:`, error);
      } finally {
        // Reset flag immediately after update completes
        isApplyingYjsUpdateRef.current = false;
      }
    }, [editor, sharedText]);

    // Observe remote Yjs changes with improved error handling
    const yObserver = (event: any, transaction: any) => {
      try {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Yjs change detected:`, {
          origin: transaction?.origin,
          clientId: clientId.current,
          isLocal: transaction?.local
        });
        applyYjsToLexical(transaction?.origin, transaction?.origin);
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error in Yjs observer:`, error);
      }
    };
    
    sharedText.observeDeep(yObserver);

    // Initial bootstrap from Yjs (only once after sync)
    if (shouldBootstrap && !hasBootstrapped.current) {
      console.log(`[LexicalYjsCollaboration:${clientId.current}] Bootstrapping from existing Yjs content`);
      applyYjsToLexical('bootstrap', 'bootstrap');
      hasBootstrapped.current = true;
    }

    // Push local Lexical changes to Yjs with improved handling
    const unregister = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Skip if we're currently applying Yjs or Lexical updates
      if (isApplyingYjsUpdateRef.current || isApplyingLexicalUpdateRef.current) {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Skipping update - applying updates (Yjs:${isApplyingYjsUpdateRef.current}, Lexical:${isApplyingLexicalUpdateRef.current})`);
        return;
      }
      
      try {
        editorState.read(() => {
          const text = $getRoot().getTextContent();
          
          // Only update if text actually changed from what we last saw
          if (text !== lastContentRef.current) {
            console.log(`[LexicalYjsCollaboration:${clientId.current}] Pushing Lexical content to Yjs:`, {
              textLength: text.length,
              preview: text.slice(0, 50),
              clientId: clientId.current
            });
            
            isApplyingLexicalUpdateRef.current = true;
            
            // Update reference BEFORE sending to Yjs to prevent race conditions
            lastContentRef.current = text;
            
            // Use transaction with client ID to prevent echo
            doc.transact(() => {
              const currentLength = sharedText.toString().length;
              if (currentLength > 0) {
                sharedText.delete(0, currentLength);
              }
              if (text) {
                sharedText.insert(0, text);
              }
            }, clientId.current);
            
            isApplyingLexicalUpdateRef.current = false;
          }
        });
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error pushing to Yjs:`, error);
        isApplyingLexicalUpdateRef.current = false;
      }
    });

    return () => {
      console.log(`[LexicalYjsCollaboration:${clientId.current}] Cleaning up Yjs text binding`);
      try {
        sharedText.unobserveDeep(yObserver);
        unregister();
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error during cleanup:`, error);
      }
    };
  }, [doc, editor, id, isSynced, shouldBootstrap]);

  return null;
}