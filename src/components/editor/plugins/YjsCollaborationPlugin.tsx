import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection } from 'lexical';
import { Doc as YDoc } from 'yjs';
import { mergeRegister } from '@lexical/utils';

interface YjsCollaborationPluginProps {
  doc: YDoc;
  awareness: any; // Using any for awareness to avoid import issues
  documentId: string;
}

export function YjsCollaborationPlugin({ doc, awareness, documentId }: YjsCollaborationPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!doc || !awareness) return;

    console.log('YjsCollaborationPlugin: Initializing for document', documentId);

    // Get or create the shared text type for this document
    const sharedText = doc.getText('content');
    
    let isRemoteUpdate = false;

    // Listen to editor changes and sync to Yjs
    const removeUpdateListener = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, prevEditorState }) => {
      if (isRemoteUpdate) return;

      editorState.read(() => {
        const root = $getRoot();
        const content = root.getTextContent();
        
        // Update Yjs document
        doc.transact(() => {
          sharedText.delete(0, sharedText.length);
          if (content) {
            sharedText.insert(0, content);
          }
        });
      });
    });

    // Listen to Yjs changes and update editor
    const handleYjsUpdate = () => {
      const yjsContent = sharedText.toString();
      
      editor.update(() => {
        isRemoteUpdate = true;
        
        const root = $getRoot();
        const currentContent = root.getTextContent();
        
        // Only update if content is different
        if (currentContent !== yjsContent) {
          root.clear();
          
          if (yjsContent) {
            // Split content into paragraphs and add them
            const lines = yjsContent.split('\n');
            lines.forEach((line, index) => {
              const paragraph = $createParagraphNode();
              if (line) {
                paragraph.append($createTextNode(line));
              }
              root.append(paragraph);
            });
          } else {
            // Add empty paragraph if no content
            root.append($createParagraphNode());
          }
        }
        
        isRemoteUpdate = false;
      });
    };

    // Subscribe to Yjs text updates
    sharedText.observe(handleYjsUpdate);

    // Initial sync from Yjs to editor if there's existing content
    const initialContent = sharedText.toString();
    if (initialContent) {
      handleYjsUpdate();
    }

    // Set up awareness for cursor and user information
    const updateAwareness = () => {
      const selection = $getSelection();
      awareness.setLocalStateField('selection', selection?.getTextContent() || '');
      awareness.setLocalStateField('lastUpdated', Date.now());
    };

    const removeSelectionListener = editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        updateAwareness();
      });
    });

    console.log('YjsCollaborationPlugin: Setup complete');

    return () => {
      console.log('YjsCollaborationPlugin: Cleaning up');
      removeUpdateListener();
      removeSelectionListener();
      sharedText.unobserve(handleYjsUpdate);
    };
  }, [editor, doc, awareness, documentId]);

  return null;
}