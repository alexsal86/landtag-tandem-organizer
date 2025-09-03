import React, { useState, useEffect, useCallback } from 'react';
import { $getRoot, $getSelection } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createParagraphNode, $createTextNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '@/hooks/useAuth';
import { useCollaborationPersistence } from '@/hooks/useCollaborationPersistence';
import { supabase } from '@/integrations/supabase/client';
import ToolbarPlugin from './lexical/ToolbarPlugin';
import FloatingTextToolbar from './FloatingTextToolbar';
import CollaborationStatus from './CollaborationStatus';

const theme = {
  // Theme styling
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'editor-placeholder',
  paragraph: 'editor-paragraph',
};

// Catch any errors that occur during Lexical updates and log them
// or throw them as needed. If you don't throw them, Lexical will
// try to recover gracefully without losing user data.
function onError(error: Error) {
  console.error(error);
}

interface CollaborationUser {
  id: string;
  name?: string;
  avatar?: string;
  color?: string;
  cursor?: { x: number; y: number };
}

interface LexicalEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  showToolbar?: boolean;
  documentId?: string; // For collaboration room
  enableCollaboration?: boolean;
}

function MyOnChangePlugin({ onChange }: { onChange?: (content: string) => void }) {
  const [editor] = useLexicalComposerContext();
  return (
    <OnChangePlugin
      onChange={(editorState) => {
        editorState.read(() => {
          const root = $getRoot();
          const content = root.getTextContent();
          onChange?.(content);
        });
      }}
    />
  );
}

const LexicalEditor: React.FC<LexicalEditorProps> = ({ 
  initialContent = '', 
  onChange, 
  placeholder = 'Beginnen Sie zu schreiben...',
  showToolbar = true,
  documentId,
  enableCollaboration = false
}) => {
  const { user } = useAuth();
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [formatCommand, setFormatCommand] = useState<string>('');
  
  // Collaboration state
  const [isConnected, setIsConnected] = useState(false);
  const [collaborationUsers, setCollaborationUsers] = useState<CollaborationUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CollaborationUser | undefined>();

  const handleFormatText = (format: string) => {
    setFormatCommand(format);
    // Reset command after a brief delay to allow processing
    setTimeout(() => setFormatCommand(''), 10);
  };

  // Set up current user for collaboration
  useEffect(() => {
    if (user && enableCollaboration) {
      setCurrentUser({
        id: user.id,
        name: user.user_metadata?.display_name || user.email || 'Anonymous',
        avatar: user.user_metadata?.avatar_url,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
      });
    }
  }, [user, enableCollaboration]);

  // Yjs collaboration setup - single shared instances
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  
  // Set up persistence hook
  const { saveManual, loadDocumentState } = useCollaborationPersistence({
    documentId,
    yDoc,
    enableCollaboration,
    debounceMs: 2000
  });

  // Create Y.Doc and Provider once when collaboration is enabled
  useEffect(() => {
    if (!enableCollaboration || !documentId || !currentUser) return;

    console.log('Setting up collaboration for document:', documentId);
    
    // Create single Y.Doc instance
    const doc = new Y.Doc();
    setYDoc(doc);
    
    // Load initial document state synchronously
    loadDocumentState(doc).then(() => {
      console.log('Initial document state loaded');
    });

    // Create WebSocket provider with proper URL
    const roomId = `knowledge-doc-${documentId}`;
    const wsProvider = new WebsocketProvider(
      'wss://wawofclbehbkebjivdte.supabase.co/functions/v1/yjs-collaboration',
      roomId,
      doc,
      {
        connect: false // Don't auto-connect, we'll connect manually
      }
    );

    // Set up awareness BEFORE connecting
    if (wsProvider.awareness) {
      wsProvider.awareness.setLocalStateField('user', {
        name: currentUser.name,
        color: currentUser.color,
        avatar: currentUser.avatar,
        id: currentUser.id
      });

      // Track awareness changes
      wsProvider.awareness.on('change', () => {
        const states = wsProvider.awareness.getStates();
        const users: CollaborationUser[] = [];
        
        states.forEach((state, clientId) => {
          if (state.user && clientId !== wsProvider.awareness.clientID) {
            users.push({
              id: state.user.id || clientId.toString(),
              name: state.user.name,
              avatar: state.user.avatar,
              color: state.user.color
            });
          }
        });
        
        console.log('Collaboration users updated:', users.length);
        setCollaborationUsers(users);
      });
    }

    // Set up connection status tracking
    wsProvider.on('status', (event: any) => {
      console.log('WebSocket status:', event);
      setIsConnected(event.status === 'connected');
      
      // Join room after connection
      if (event.status === 'connected' && wsProvider.ws) {
        console.log('Joining room:', roomId);
        wsProvider.ws.send(JSON.stringify({
          type: 'join-room',
          room: roomId
        }));
      }
    });

    wsProvider.on('connection-error', (error: any) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Connect the provider
    wsProvider.connect();
    setProvider(wsProvider);

    // Cleanup function
    return () => {
      console.log('Cleaning up collaboration');
      wsProvider.awareness?.destroy();
      wsProvider.disconnect();
      doc.destroy();
      setYDoc(null);
      setProvider(null);
      setIsConnected(false);
      setCollaborationUsers([]);
    };
  }, [enableCollaboration, documentId, currentUser, loadDocumentState]);

  // Provider factory for Lexical CollaborationPlugin
  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Y.Doc>) => {
    console.log('Provider factory called for:', id);
    
    // Return existing provider if available
    if (provider && yDoc) {
      // Ensure the document is in the map
      if (!yjsDocMap.has(id)) {
        yjsDocMap.set(id, yDoc);
      }
      console.log('Returning existing provider');
      return provider as any;
    }
    
    // Create a placeholder provider that won't crash on disconnect
    console.warn('Provider factory called but no provider available, returning placeholder');
    return {
      disconnect: () => console.log('Placeholder provider disconnect called'),
      awareness: null,
      ws: null,
      on: () => {},
      off: () => {},
      destroy: () => {}
    } as any;
  }, [provider, yDoc]);
  const initialConfig = {
    namespace: 'KnowledgeBaseEditor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode,
    ],
    editorState: () => {
      const root = $getRoot();
      if (root.getFirstChild() === null && initialContent) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(initialContent));
        root.append(paragraph);
      }
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-container">
        {showToolbar && (
          <FloatingTextToolbar
            onFormatText={handleFormatText}
            activeFormats={activeFormats}
          />
        )}
        
        {/* Collaboration Status */}
        {enableCollaboration && documentId && (
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CollaborationStatus
                isConnected={isConnected}
                users={collaborationUsers}
                currentUser={currentUser}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveManual}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Snapshot speichern
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="editor-input" />
            }
            placeholder={
              <div className="editor-placeholder">{placeholder}</div>
            }
            ErrorBoundary={({ children }) => <div>{children}</div>}
          />
          {!enableCollaboration && <HistoryPlugin />}
          <ListPlugin />
          <LinkPlugin />
          {enableCollaboration && documentId && provider && yDoc && (
            <CollaborationPlugin
              id={`knowledge-doc-${documentId}`}
              providerFactory={providerFactory}
              shouldBootstrap={true}
            />
          )}
          <ToolbarPlugin 
            onFormatChange={setActiveFormats}
            formatCommand={formatCommand}
          />
          <MyOnChangePlugin onChange={onChange} />
        </div>
      </div>
    </LexicalComposer>
  );
};

export default LexicalEditor;