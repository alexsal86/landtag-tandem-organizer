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
import { YjsProvider, useYjsProvider } from './collaboration/YjsProvider';
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
  sendContentUpdate: (content: string, contentNodes?: string) => void;
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

// Content Sync Plugin to handle Yjs to Supabase synchronization
function YjsContentSyncPlugin({ 
  initialContent, 
  onContentSync,
  documentId 
}: { 
  initialContent: string;
  onContentSync: (content: string) => void;
  documentId: string;
}) {
  const [editor] = useLexicalComposerContext();
  const yjsProvider = useYjsProvider();
  const lastSyncedContentRef = useRef<string>('');
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  // Initial sync: Load Supabase content into Yjs when connected
  useEffect(() => {
    if (yjsProvider?.isSynced && initialContent && initialContent !== lastSyncedContentRef.current) {
      console.log('🔄 [Hybrid] Syncing initial Supabase content to Yjs:', initialContent);
      
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        
        if (initialContent.trim()) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(initialContent));
          root.append(paragraph);
        }
        
        lastSyncedContentRef.current = initialContent;
      });
    }
  }, [yjsProvider?.isSynced, initialContent, editor]);

  // Periodic sync: Save Yjs content back to Supabase
  useEffect(() => {
    if (yjsProvider?.isSynced) {
      syncIntervalRef.current = setInterval(() => {
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const currentContent = root.getTextContent();
          
          if (currentContent !== lastSyncedContentRef.current) {
            console.log('💾 [Hybrid] Syncing Yjs content back to Supabase:', currentContent);
            lastSyncedContentRef.current = currentContent;
            onContentSync(currentContent);
          }
        });
      }, 2000); // Sync every 2 seconds
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [yjsProvider?.isSynced, editor, onContentSync]);

  return null;
}

// Yjs Collaboration Editor component
function YjsCollaborationEditor(props: any) {
  const yjsProvider = useYjsProvider();
  
  return (
    <div className="relative min-h-[200px] border rounded-md">
      {(!yjsProvider?.isSynced || !yjsProvider?.isConnected) && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {!yjsProvider?.isConnected ? 'Connecting...' : 'Synchronizing...'}
          </div>
        </div>
      )}
      <YjsSyncStatus>
        <LexicalComposer 
          initialConfig={props.initialConfig}
          key={`yjs-editor-${props.documentId}`}
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
                  {props.placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            
            {/* Official Yjs Collaboration Plugin */}
            <LexicalYjsCollaborationPlugin
              id={props.documentId}
              shouldBootstrap={true}
            />
            
            {/* Content Synchronization Plugin */}
            <YjsContentSyncPlugin
              initialContent={props.initialContent}
              onContentSync={props.onContentSync}
              documentId={props.documentId}
            />
            
            <HistoryPlugin />
          </div>
        </LexicalComposer>
      </YjsSyncStatus>
    </div>
  );
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

  // Handle final sync when switching away from Yjs
  const handleYjsContentSync = useCallback((yjsContent: string) => {
    if (yjsContent !== localContent) {
      console.log('🔄 [Hybrid] Syncing content from Yjs to Supabase:', yjsContent);
      setLocalContent(yjsContent);
      onChange(yjsContent);
    }
  }, [localContent, onChange]);

  // Render Yjs collaboration editor
  if (shouldUseYjs && enableCollaboration && documentId) {
    return (
      <YjsProvider
        documentId={documentId}
        onConnected={() => console.log('[Yjs] Connected to collaboration')}
        onDisconnected={() => {
          console.log('[Yjs] Disconnected from collaboration');
          // Perform final sync when disconnecting
        }}
        onCollaboratorsChange={(collaborators) => console.log('[Yjs] Collaborators:', collaborators)}
      >
        <div className="editor-container space-y-4">
          {/* Enhanced Status Indicators */}
          <div className="mb-2 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Real-time Collaboration (Yjs)</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Auto-sync to database active
              </div>
            </div>
            <YjsCollaborationStatus />
          </div>

          {/* Editor with Yjs collaboration and content sync */}
          <YjsCollaborationEditor
            initialConfig={initialConfig}
            documentId={documentId}
            placeholder={placeholder}
            initialContent={content}
            onContentSync={handleYjsContentSync}
          />
        </div>
      </YjsProvider>
    );
  }

  // Component to show Yjs collaboration status using provider context
  function YjsCollaborationStatus() {
    const yjsProvider = useYjsProvider();
    
    return (
      <CollaborationStatus
        isConnected={yjsProvider.isConnected}
        isConnecting={!yjsProvider.isConnected && !yjsProvider.isSynced}
        users={yjsProvider.collaborators}
        currentUser={yjsProvider.currentUser}
      />
    );
  }

  // Render standard editor (with optional Supabase Realtime collaboration)
  return (
    <div className="editor-container space-y-4">
      {/* Enhanced Status Indicators */}
      {enableCollaboration && documentId ? (
        <div className="mb-2 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium">Real-time Collaboration (Supabase)</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Instant sync active
            </div>
          </div>
          <CollaborationStatus
            isConnected={collaboration.isConnected}
            isConnecting={collaboration.isConnecting}
            users={collaboration.collaborators}
            currentUser={collaboration.currentUser}
          />
        </div>
      ) : (
        <div className="mb-2 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            <span className="text-sm font-medium">Single User Mode</span>
            <div className="text-xs text-muted-foreground ml-auto">
              No real-time collaboration
            </div>
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