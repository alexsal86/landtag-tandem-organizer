import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
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
import { YjsProvider } from './collaboration/YjsProvider';
import { LexicalYjsCollaborationPlugin } from './collaboration/LexicalYjsCollaborationPlugin';
import { YjsSyncStatus } from './collaboration/YjsSyncStatus';

// Feature flag for Yjs collaboration
const ENABLE_YJS_COLLABORATION = true;

interface SimpleLexicalEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  documentId?: string;
  enableCollaboration?: boolean;
  useYjsCollaboration?: boolean; // Option to use Yjs instead of Supabase Realtime
}

// Content Plugin to sync content (simplified for Supabase Realtime)
function ContentPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  
  React.useEffect(() => {
    if (content) {
      editor.update(() => {
        const root = $getRoot();
        if (root.isEmpty()) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(content));
          root.append(paragraph);
        }
      });
    }
  }, [editor, content]);

  return null;
}

// Collaboration Plugin for Supabase Realtime
function CollaborationPlugin({ 
  documentId, 
  onContentChange,
  sendContentUpdate,
  remoteContent 
}: { 
  documentId: string;
  onContentChange: (content: string) => void;
  sendContentUpdate: (content: string) => void;
  remoteContent: string;
}) {
  const [editor] = useLexicalComposerContext();
  const lastContentRef = useRef<string>('');
  const isRemoteUpdateRef = useRef<boolean>(false);

  // Handle remote content changes
  React.useEffect(() => {
    if (remoteContent && remoteContent !== lastContentRef.current) {
      console.log('📝 Applying remote content to editor:', remoteContent);
      isRemoteUpdateRef.current = true;
      
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        
        if (remoteContent.trim()) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(remoteContent));
          root.append(paragraph);
        }
        
        lastContentRef.current = remoteContent;
      }, {
        onUpdate: () => {
          // Reset the flag after the update is complete
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 0);
        }
      });
    }
  }, [editor, remoteContent]);

  // Handle local content changes
  const handleLocalContentChange = useCallback((editorState: EditorState) => {
    if (isRemoteUpdateRef.current) {
      console.log('🚫 Skipping local change handler - remote update in progress');
      return;
    }
    
    editorState.read(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      
      if (textContent !== lastContentRef.current) {
        console.log('📝 Local content change detected:', textContent);
        lastContentRef.current = textContent;
        onContentChange(textContent);
        
        // Debounce sending to collaboration
        setTimeout(() => {
          if (lastContentRef.current === textContent) {
            console.log('📡 Sending content update to collaboration:', textContent);
            sendContentUpdate(textContent);
          }
        }, 300);
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
  enableCollaboration = false,
  useYjsCollaboration = ENABLE_YJS_COLLABORATION
}: SimpleLexicalEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [remoteContent, setRemoteContent] = useState<string>('');
  
  // Choose collaboration provider based on feature flag
  const shouldUseYjs = enableCollaboration && useYjsCollaboration;
  
  // Initialize Supabase Realtime collaboration hook (only when not using Yjs)
  const realtimeCollaboration = useCollaboration({
    documentId: enableCollaboration && !shouldUseYjs && documentId ? documentId : '',
    onContentChange: (newContent: string) => {
      if (enableCollaboration && !shouldUseYjs) {
        console.log('📝 [Realtime] Remote content change received:', newContent);
        setRemoteContent(newContent);
        setLocalContent(newContent);
        onChange(newContent);
      }
    },
    onCursorChange: (userId: string, cursor: any) => {
      if (enableCollaboration && !shouldUseYjs) {
        console.log('[Realtime] Cursor change from user:', userId, cursor);
      }
    },
    onSelectionChange: (userId: string, selection: any) => {
      if (enableCollaboration && !shouldUseYjs) {
        console.log('[Realtime] Selection change from user:', userId, selection);
      }
    }
  });

  // Select active collaboration provider
  const collaboration = realtimeCollaboration;

  // Memoize initial config to prevent re-initialization
  const initialConfig = useMemo(() => ({
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
  }), []);

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

  // Render Yjs collaboration editor
  if (shouldUseYjs && enableCollaboration && documentId) {
    return (
      <YjsProvider
        documentId={documentId}
        onConnected={() => console.log('[Yjs] Connected to collaboration')}
        onDisconnected={() => console.log('[Yjs] Disconnected from collaboration')}
        onCollaboratorsChange={(collaborators) => console.log('[Yjs] Collaborators:', collaborators)}
      >
        <div className="editor-container space-y-4">
          {/* Collaboration Status */}
          <div className="mb-2">
            <CollaborationStatus
              isConnected={true} // Will be updated via YjsProvider context
              isConnecting={false}
              users={[]} // Will be updated via YjsProvider context
              currentUser={null}
            />
            <div className="text-xs text-muted-foreground mt-1">
              Using Yjs CRDT collaboration
            </div>
          </div>

          {/* Editor with Yjs collaboration */}
          <YjsSyncStatus>
            <div className="border rounded-lg">
              <LexicalComposer 
                initialConfig={initialConfig}
                key={`yjs-editor-${documentId}`}
              >
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
                  
                  {/* Official Yjs Collaboration Plugin */}
                  <LexicalYjsCollaborationPlugin
                    id={documentId}
                    shouldBootstrap={true}
                  />
                  
                  <HistoryPlugin />
                </div>
              </LexicalComposer>
            </div>
          </YjsSyncStatus>
        </div>
      </YjsProvider>
    );
  }

  // Render standard editor (with optional Supabase Realtime collaboration)
  return (
    <div className="editor-container space-y-4">
      {/* Collaboration Status - only show if enabled */}
      {enableCollaboration && documentId && (
        <div className="mb-2">
          <CollaborationStatus
            isConnected={collaboration.isConnected}
            isConnecting={collaboration.isConnecting}
            users={collaboration.collaborators}
            currentUser={collaboration.currentUser}
          />
          <div className="text-xs text-muted-foreground mt-1">
            Using Supabase Realtime collaboration
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="border rounded-lg">
        <LexicalComposer 
          initialConfig={initialConfig}
          key={`standard-editor-${documentId ?? 'new'}`}
        >
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
                remoteContent={remoteContent}
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