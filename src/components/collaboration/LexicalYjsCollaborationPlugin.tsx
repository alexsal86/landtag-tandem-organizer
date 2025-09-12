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
  const { doc } = useYjsProvider();
  const lastContentRef = useRef<string>('');
  const isApplyingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!doc || !editor) return;

    console.log('[LexicalYjsCollaboration] Setting up Yjs text binding for:', id);

    // Use a consistent Yjs key name that doesn't conflict
    const sharedText = doc.getText('content');

    const applyYjsToLexical = () => {
      const content = sharedText.toString();
      if (content === lastContentRef.current) return;

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
      // allow lexical update listeners to run before clearing flag
      setTimeout(() => {
        isApplyingRef.current = false;
      }, 0);
    };

    // Observe remote Yjs changes
    const yObserver = () => applyYjsToLexical();
    sharedText.observe(yObserver);

    // Initial bootstrap from Yjs
    applyYjsToLexical();

    // Push local Lexical changes to Yjs
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      if (isApplyingRef.current) return;
      editorState.read(() => {
        const text = $getRoot().getTextContent();
        if (text !== lastContentRef.current) {
          lastContentRef.current = text;
          const prevLen = sharedText.toString().length;
          if (prevLen > 0) sharedText.delete(0, prevLen);
          if (text) sharedText.insert(0, text);
        }
      });
    });

    return () => {
      console.log('[LexicalYjsCollaboration] Cleaning up Yjs text binding');
      sharedText.unobserve(yObserver);
      unregister();
    };
  }, [doc, editor, id]);

  return null;
}