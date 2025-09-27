import React, { useEffect, useRef } from 'react';
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
  const { doc, isSynced } = useYjsProvider();
  const lastContentRef = useRef<string>('');
  const isApplyingRef = useRef<boolean>(false);
  const hasBootstrapped = useRef<boolean>(false);

  useEffect(() => {
    if (!doc || !editor || !isSynced) return;

    console.log('[LexicalYjsCollaboration] Setting up improved plaintext Yjs binding for:', id);

    // Use a consistent Yjs key name
    const sharedText = doc.getText('content');

    const applyYjsToLexical = (origin?: any) => {
      // Prevent echo: only apply if it's a remote change or initial bootstrap
      if (origin === 'lexical') {
        console.log('[LexicalYjsCollaboration] Skipping echo - origin is lexical');
        return;
      }
      
      const content = sharedText.toString();
      
      // Skip if content hasn't changed
      if (content === lastContentRef.current) {
        console.log('[LexicalYjsCollaboration] Content unchanged, skipping update');
        return;
      }

      console.log('[LexicalYjsCollaboration] Applying Yjs content to Lexical:', content.slice(0, 100));
      
      isApplyingRef.current = true;
      
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
          
          lastContentRef.current = content;
        });
      } catch (error) {
        console.error('[LexicalYjsCollaboration] Error applying Yjs content:', error);
      } finally {
        // Reset flag after update completes
        setTimeout(() => {
          isApplyingRef.current = false;
        }, 0);
      }
    };

    // Observe remote Yjs changes with improved error handling
    const yObserver = (event: any, transaction: any) => {
      try {
        console.log('[LexicalYjsCollaboration] Yjs change detected, origin:', transaction?.origin);
        applyYjsToLexical(transaction?.origin);
      } catch (error) {
        console.error('[LexicalYjsCollaboration] Error in Yjs observer:', error);
      }
    };
    
    sharedText.observeDeep(yObserver);

    // Initial bootstrap from Yjs (only once after sync)
    if (shouldBootstrap && !hasBootstrapped.current) {
      console.log('[LexicalYjsCollaboration] Bootstrapping from existing Yjs content');
      applyYjsToLexical('bootstrap');
      hasBootstrapped.current = true;
    }

    // Push local Lexical changes to Yjs with improved handling
    const unregister = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Skip if we're currently applying Yjs changes
      if (isApplyingRef.current) {
        console.log('[LexicalYjsCollaboration] Skipping update - applying Yjs changes');
        return;
      }
      
      try {
        editorState.read(() => {
          const text = $getRoot().getTextContent();
          
          // Only update if text actually changed
          if (text !== lastContentRef.current) {
            console.log('[LexicalYjsCollaboration] Pushing Lexical content to Yjs:', text.slice(0, 100));
            lastContentRef.current = text;
            
            // Use transaction with origin to prevent echo
            doc.transact(() => {
              const currentLength = sharedText.toString().length;
              if (currentLength > 0) {
                sharedText.delete(0, currentLength);
              }
              if (text) {
                sharedText.insert(0, text);
              }
            }, 'lexical');
          }
        });
      } catch (error) {
        console.error('[LexicalYjsCollaboration] Error pushing to Yjs:', error);
      }
    });

    return () => {
      console.log('[LexicalYjsCollaboration] Cleaning up Yjs text binding');
      try {
        sharedText.unobserveDeep(yObserver);
        unregister();
      } catch (error) {
        console.error('[LexicalYjsCollaboration] Error during cleanup:', error);
      }
    };
  }, [doc, editor, id, isSynced, shouldBootstrap]);

  return null;
}