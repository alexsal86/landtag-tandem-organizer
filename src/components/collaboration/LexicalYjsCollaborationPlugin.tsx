import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import * as Y from 'yjs';
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

    console.log('[LexicalYjsCollaboration] Setting up structured Lexical Yjs binding for:', id);

    // Use Y.Text for storing JSON-serialized EditorState
    const sharedText = doc.getText('content');

    const applyYjsToLexical = (origin?: any, transactionOrigin?: string) => {
      // Prevent echo: skip if this update originated from our own Lexical editor
      const isOwnUpdate = transactionOrigin === clientId.current;
      
      if (isOwnUpdate) {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Skipping echo - transaction:`, transactionOrigin);
        return;
      }
      
      // Get serialized state from Y.Text
      const serializedState = sharedText.toString();
      
      // Skip if we're already applying a Yjs update or content hasn't changed
      if (isApplyingYjsUpdateRef.current || serializedState === lastContentRef.current) {
        console.log(`[LexicalYjsCollaboration:${clientId.current}] Skipping - applying:${isApplyingYjsUpdateRef.current}, unchanged:${serializedState === lastContentRef.current}`);
        return;
      }

      console.log(`[LexicalYjsCollaboration:${clientId.current}] Applying Yjs content to Lexical:`, {
        origin,
        transactionOrigin,
        contentLength: serializedState.length,
        preview: serializedState.slice(0, 100)
      });
      
      isApplyingYjsUpdateRef.current = true;
      
      try {
        if (serializedState.trim()) {
          // Parse JSON string to object, then parse as EditorState
          try {
            const stateObject = JSON.parse(serializedState);
            const editorState = editor.parseEditorState(stateObject);
            editor.setEditorState(editorState);
            lastContentRef.current = serializedState;
            console.log(`[LexicalYjsCollaboration:${clientId.current}] Successfully applied EditorState from Yjs`);
          } catch (parseError) {
            console.error(`[LexicalYjsCollaboration:${clientId.current}] Failed to parse EditorState:`, parseError);
            // Reset to empty state instead of showing JSON
            editor.update(() => {
              const root = $getRoot();
              root.clear();
              const p = $createParagraphNode();
              root.append(p);
            });
            lastContentRef.current = '';
          }
        } else {
          // Empty content - add single empty paragraph
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const p = $createParagraphNode();
            root.append(p);
          });
          lastContentRef.current = serializedState;
        }
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error applying Yjs content:`, error);
      } finally {
        // Reset flag immediately after update completes
        isApplyingYjsUpdateRef.current = false;
      }
    };

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
    
    sharedText.observe(yObserver);

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
        // Serialize the entire EditorState as JSON for structured data
        const serializedState = JSON.stringify(editorState.toJSON());
        
        // Only update if state actually changed
        if (serializedState !== lastContentRef.current) {
          console.log(`[LexicalYjsCollaboration:${clientId.current}] Pushing Lexical EditorState to Yjs:`, {
            stateLength: serializedState.length,
            preview: serializedState.slice(0, 100),
            clientId: clientId.current
          });
          
          isApplyingLexicalUpdateRef.current = true;
          
          // Update reference BEFORE sending to Yjs to prevent race conditions
          lastContentRef.current = serializedState;
          
          // Use transaction with client ID to prevent echo
          doc.transact(() => {
            // Replace entire content with new serialized state
            const currentLength = sharedText.length;
            if (currentLength > 0) {
              sharedText.delete(0, currentLength);
            }
            if (serializedState) {
              sharedText.insert(0, serializedState);
            }
          }, clientId.current);
          
          isApplyingLexicalUpdateRef.current = false;
        }
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error pushing to Yjs:`, error);
        isApplyingLexicalUpdateRef.current = false;
      }
    });

    return () => {
      console.log(`[LexicalYjsCollaboration:${clientId.current}] Cleaning up Yjs text binding`);
      try {
        sharedText.unobserve(yObserver);
        unregister();
      } catch (error) {
        console.error(`[LexicalYjsCollaboration:${clientId.current}] Error during cleanup:`, error);
      }
    };
  }, [doc, editor, id, isSynced, shouldBootstrap]);

  return null;
}