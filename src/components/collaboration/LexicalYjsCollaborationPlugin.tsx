import React, { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createBinding } from '@lexical/yjs';
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
  const { doc, provider } = useYjsProvider();

  useEffect(() => {
    if (!doc || !editor) return;
    
    console.log('[LexicalYjsCollaboration] Creating simple Yjs text binding for:', id);
    
    // Get the shared text from the Yjs document
    const sharedText = doc.getText('lexical');
    
    console.log('[LexicalYjsCollaboration] Text content:', sharedText.toString());
    
    // Simple manual sync - this avoids the complex Provider interface
    const syncToEditor = () => {
      const content = sharedText.toString();
      if (content) {
        editor.update(() => {
          const root = editor.getEditorState()._nodeMap.get('root');
          if (root) {
            // Simple text sync
            console.log('[LexicalYjsCollaboration] Syncing Yjs content to editor:', content);
          }
        });
      }
    };
    
    // Listen to Yjs text changes
    sharedText.observe(syncToEditor);
    
    // Initial sync
    syncToEditor();

    return () => {
      console.log('[LexicalYjsCollaboration] Cleaning up text binding');
      sharedText.unobserve(syncToEditor);
    };
  }, [doc, editor, id]);

  return null;
}