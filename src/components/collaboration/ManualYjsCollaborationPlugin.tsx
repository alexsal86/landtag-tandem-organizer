import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { useYjsProvider } from './YjsProvider';

interface ManualYjsCollaborationPluginProps {
  documentId: string;
  shouldBootstrap?: boolean;
}

export function ManualYjsCollaborationPlugin({ 
  documentId, 
  shouldBootstrap = true 
}: ManualYjsCollaborationPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { doc, isSynced } = useYjsProvider();
  const lastContentRef = useRef<string>('');
  const isApplyingRef = useRef<boolean>(false);
  const hasBootstrapped = useRef<boolean>(false);

  useEffect(() => {
    if (!doc || !editor || !isSynced) {
      console.log('[ManualYjsCollaboration] Missing requirements', {
        hasDoc: !!doc,
        hasEditor: !!editor,
        isSynced
      });
      return;
    }

    console.log('[ManualYjsCollaboration] Setting up manual Yjs binding for:', documentId);

    const sharedText = doc.getText('content');

    // Serialize Lexical state to JSON for rich text collaboration
    const lexicalToYjs = () => {
      if (isApplyingRef.current) return;
      
      editor.getEditorState().read(() => {
        const json = editor.getEditorState().toJSON();
        const jsonString = JSON.stringify(json);
        
        if (jsonString !== lastContentRef.current) {
          console.log('[ManualYjsCollaboration] Pushing rich Lexical state to Yjs');
          lastContentRef.current = jsonString;
          
          doc.transact(() => {
            const prevLen = sharedText.toString().length;
            if (prevLen > 0) sharedText.delete(0, prevLen);
            if (jsonString) sharedText.insert(0, jsonString);
          }, 'lexical');
        }
      });
    };

    // Deserialize Yjs content to Lexical state with rich text support
    const yjsToLexical = (origin?: any) => {
      if (origin === 'lexical') return;
      
      const content = sharedText.toString();
      if (content === lastContentRef.current) return;

      console.log('[ManualYjsCollaboration] Applying rich Yjs content to Lexical');
      isApplyingRef.current = true;
      
      try {
        if (content.trim()) {
          const parsedState = JSON.parse(content);
          const editorState = editor.parseEditorState(parsedState);
          editor.setEditorState(editorState);
        } else {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
          });
        }
        lastContentRef.current = content;
      } catch (e) {
        console.warn('[ManualYjsCollaboration] Failed to parse JSON, using plain text:', e);
        // Fallback to plain text
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          if (content.trim()) {
            const p = $createParagraphNode();
            p.append($createTextNode(content));
            root.append(p);
          }
        });
        lastContentRef.current = content;
      }
      
      setTimeout(() => {
        isApplyingRef.current = false;
      }, 0);
    };

    // Observe Yjs changes
    const yObserver = (event: any, transaction: any) => {
      yjsToLexical(transaction.origin);
    };
    sharedText.observeDeep(yObserver);

    // Bootstrap initial content
    if (shouldBootstrap && !hasBootstrapped.current) {
      console.log('[ManualYjsCollaboration] Bootstrapping from Yjs');
      yjsToLexical();
      hasBootstrapped.current = true;
    }

    // Listen to local Lexical changes
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      lexicalToYjs();
    });

    return () => {
      console.log('[ManualYjsCollaboration] Cleaning up manual Yjs binding');
      sharedText.unobserveDeep(yObserver);
      unregister();
    };
  }, [doc, editor, documentId, isSynced, shouldBootstrap]);

  return null;
}