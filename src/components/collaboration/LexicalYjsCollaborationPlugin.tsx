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

    console.log('[LexicalYjsCollaboration] Setting up Yjs text binding for:', id);

    // Use a consistent Yjs key name that doesn't conflict
    const sharedText = doc.getText('content');

    const applyYjsToLexical = (origin?: any) => {
      // Only apply if it's a remote change or initial bootstrap
      if (origin === 'lexical') return;
      
      const content = sharedText.toString();
      if (content === lastContentRef.current) return;

      console.log('[LexicalYjsCollaboration] Applying Yjs content to Lexical:', content.slice(0, 50));
      isApplyingRef.current = true;
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        if (content.trim()) {
          const p = $createParagraphNode();
          p.append($createTextNode(content));
          root.append(p);
        }
        lastContentRef.current = content;
      });
      // Allow lexical update listeners to run before clearing flag
      setTimeout(() => {
        isApplyingRef.current = false;
      }, 0);
    };

    // Observe remote Yjs changes with origin tracking
    const yObserver = (event: any, transaction: any) => {
      applyYjsToLexical(transaction.origin);
    };
    sharedText.observeDeep(yObserver);

    // Initial bootstrap from Yjs (only once after sync)
    if (shouldBootstrap && !hasBootstrapped.current) {
      console.log('[LexicalYjsCollaboration] Bootstrapping from Yjs');
      applyYjsToLexical();
      hasBootstrapped.current = true;
    }

    // Push local Lexical changes to Yjs with origin tagging
    const unregister = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (isApplyingRef.current) return;
      
      editorState.read(() => {
        const text = $getRoot().getTextContent();
        if (text !== lastContentRef.current) {
          console.log('[LexicalYjsCollaboration] Pushing Lexical content to Yjs:', text.slice(0, 50));
          lastContentRef.current = text;
          
          // Use transaction with origin to prevent echo
          doc.transact(() => {
            const prevLen = sharedText.toString().length;
            if (prevLen > 0) sharedText.delete(0, prevLen);
            if (text) sharedText.insert(0, text);
          }, 'lexical');
        }
      });
    });

    return () => {
      console.log('[LexicalYjsCollaboration] Cleaning up Yjs text binding');
      sharedText.unobserveDeep(yObserver);
      unregister();
    };
  }, [doc, editor, id, isSynced, shouldBootstrap]);

  return null;
}