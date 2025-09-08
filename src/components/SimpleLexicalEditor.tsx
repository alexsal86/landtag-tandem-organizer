import React, { useCallback, useEffect, useState, useRef } from 'react';
import { $getRoot, $getSelection, EditorState } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createParagraphNode, $createTextNode } from 'lexical';
import { useCollaboration } from '@/hooks/useCollaboration';
import CollaborationStatus from './CollaborationStatus';

interface SimpleLexicalEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  documentId?: string;
  enableCollaboration?: boolean;
}

// Content Plugin to sync content
function ContentPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  
  React.useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      if (root.isEmpty() && content) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(content));
        root.append(paragraph);
      }
    });
  }, [editor, content]);

  return null;
}

// Collaboration Plugin for real-time collaboration
function CollaborationPlugin({ 
  documentId, 
  onContentChange,
  sendContentUpdate 
}: { 
  documentId: string;
  onContentChange: (content: string) => void;
  sendContentUpdate: (content: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const lastContentRef = useRef<string>('');
  const isRemoteUpdateRef = useRef<boolean>(false);

  // Handle remote content changes
  const handleRemoteContentChange = useCallback((newContent: string) => {
    if (newContent !== lastContentRef.current && !isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = true;
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        if (newContent) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(newContent));
          root.append(paragraph);
        }
      });
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 100);
    }
  }, [editor]);

  // Handle local content changes
  const handleLocalContentChange = useCallback((editorState: EditorState) => {
    if (isRemoteUpdateRef.current) return;
    
    editorState.read(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      
      if (textContent !== lastContentRef.current) {
        lastContentRef.current = textContent;
        onContentChange(textContent);
        
        // Debounce sending to collaboration server
        setTimeout(() => {
          if (lastContentRef.current === textContent) {
            sendContentUpdate(textContent);
          }
        }, 500);
      }
    });
  }, [onContentChange, sendContentUpdate]);

  return <OnChangePlugin onChange={handleLocalContentChange} />;
}

export default function SimpleLexicalEditor({ 
  content, 
  onChange, 
  placeholder = "Beginnen Sie zu schreiben...",
  documentId,
  enableCollaboration = false
}: SimpleLexicalEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  
  // Initialize collaboration if enabled
  const collaboration = useCollaboration({
    documentId: documentId || '',
    onContentChange: (newContent: string) => {
      setLocalContent(newContent);
      onChange(newContent);
    },
    onCursorChange: (userId: string, cursor: any) => {
      // Handle cursor position changes from other users
      console.log('Cursor change from user:', userId, cursor);
    },
    onSelectionChange: (userId: string, selection: any) => {
      // Handle selection changes from other users
      console.log('Selection change from user:', userId, selection);
    }
  });

  const initialConfig = {
    namespace: 'KnowledgeEditor',
    theme: {
      paragraph: 'editor-paragraph',
      text: {
        bold: 'editor-text-bold',
        italic: 'editor-text-italic',
        underline: 'editor-text-underline',
      },
    },
    onError: (error: Error) => {
      console.error('Lexical Error:', error);
    },
    nodes: []
  };

  const handleOnChange = useCallback((editorState: EditorState) => {
    if (!enableCollaboration) {
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        setLocalContent(textContent);
        onChange(textContent);
      });
    }
  }, [onChange, enableCollaboration]);

  // Update local content when prop changes (for non-collaborative mode)
  useEffect(() => {
    if (!enableCollaboration && content !== localContent) {
      setLocalContent(content);
    }
  }, [content, localContent, enableCollaboration]);

  return (
    <div className="editor-container space-y-4">
      {/* Collaboration Status */}
      {enableCollaboration && documentId && (
        <CollaborationStatus
          isConnected={collaboration.isConnected}
          users={collaboration.collaborators}
          currentUser={collaboration.currentUser}
        />
      )}

      {/* Editor */}
      <div className="border rounded-lg">
        <LexicalComposer initialConfig={initialConfig}>
          <div className="editor-inner relative">
            <PlainTextPlugin
              contentEditable={
                <ContentEditable 
                  className="editor-input min-h-[300px] p-4 focus:outline-none resize-none" 
                />
              }
              placeholder={
                <div className="editor-placeholder absolute top-4 left-4 text-muted-foreground pointer-events-none">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            
            {/* Plugins */}
            {enableCollaboration && documentId ? (
              <CollaborationPlugin
                documentId={documentId}
                onContentChange={(newContent) => {
                  setLocalContent(newContent);
                  onChange(newContent);
                }}
                sendContentUpdate={collaboration.sendContentUpdate}
              />
            ) : (
              <OnChangePlugin onChange={handleOnChange} />
            )}
            
            <HistoryPlugin />
            
            {!enableCollaboration && (
              <ContentPlugin content={localContent} />
            )}
          </div>
        </LexicalComposer>
      </div>
    </div>
  );
}