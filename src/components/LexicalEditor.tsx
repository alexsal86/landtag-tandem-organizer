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
import FixedTextToolbar from './FixedTextToolbar';
import ToolbarPlugin from './lexical/ToolbarPlugin';
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

  // Yjs collaboration setup
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  // Set up persistence hook
  const { saveManual } = useCollaborationPersistence({
    documentId,
    yDoc,
    enableCollaboration,
    debounceMs: 3000
  });

  useEffect(() => {
    if (enableCollaboration && documentId) {
      const doc = new Y.Doc();
      setYDoc(doc);

      return () => {
        doc.destroy();
      };
    }
  }, [enableCollaboration, documentId]);

  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Y.Doc>) => {
    let doc = yjsDocMap.get(id);
    
    if (!doc) {
      doc = new Y.Doc();
      yjsDocMap.set(id, doc);
    }

    const wsProvider = new WebsocketProvider(
      'wss://wawofclbehbkebjivdte.supabase.co/functions/v1/yjs-collaboration',
      id,
      doc
    );

    // Set up connection status tracking
    wsProvider.on('status', (event: any) => {
      setIsConnected(event.status === 'connected');
    });

    // Set up awareness for user presence
    if (currentUser && wsProvider.awareness) {
      wsProvider.awareness.setLocalStateField('user', {
        name: currentUser.name,
        color: currentUser.color,
        avatar: currentUser.avatar
      });

      // Track awareness changes
      wsProvider.awareness.on('change', () => {
        const states = wsProvider.awareness.getStates();
        const users: CollaborationUser[] = [];
        
        states.forEach((state, clientId) => {
          if (state.user) {
            users.push({
              id: clientId.toString(),
              name: state.user.name,
              avatar: state.user.avatar,
              color: state.user.color
            });
          }
        });
        
        setCollaborationUsers(users);
      });
    }

    setProvider(wsProvider);
    return wsProvider as any; // Type assertion to bypass compatibility issue
  }, [currentUser]);
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
          <FixedTextToolbar
            onFormatText={handleFormatText}
            activeFormats={activeFormats}
          />
        )}
        
        {/* Collaboration Status */}
        {enableCollaboration && documentId && (
          <div className="p-3 border-b border-border">
            <CollaborationStatus
              isConnected={isConnected}
              users={collaborationUsers}
              currentUser={currentUser}
            />
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
          {enableCollaboration && documentId && (
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