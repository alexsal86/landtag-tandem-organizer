import React, { useState, useCallback, useEffect } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  TextFormatType,
  UNDO_COMMAND,
  REDO_COMMAND,
} from 'lexical';
import { $isHeadingNode, $createHeadingNode, HeadingTagType } from '@lexical/rich-text';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from '@lexical/list';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Provider } from '@lexical/yjs';
import { 
  LexicalComposer,
  InitialConfigType
} from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCollaborationContext } from '@lexical/react/LexicalCollaborationContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

import { HeadingNode } from '@lexical/rich-text';
import { ListItemNode, ListNode as LexicalListNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { CodeNode } from '@lexical/code';

import { Button } from '@/components/ui/button';
import { 
  Undo, 
  Redo, 
  Bold, 
  Italic, 
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Users
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import './CleanLexicalEditor.css';

// Define our editor theme
const editorTheme = {
  paragraph: 'mb-2',
  heading: {
    h1: 'text-3xl font-bold mb-4 mt-6',
    h2: 'text-2xl font-semibold mb-3 mt-5',
    h3: 'text-xl font-medium mb-2 mt-4',
  },
  list: {
    nested: {
      listitem: 'list-none',
    },
    ol: 'list-decimal list-inside mb-2',
    ul: 'list-disc list-inside mb-2',
    listitem: 'mb-1',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
  },
};

// Editor configuration - no HistoryPlugin as CollaborationPlugin handles history
const editorConfig: InitialConfigType = {
  namespace: 'CleanLexicalEditor',
  nodes: [HeadingNode, LinkNode, LexicalListNode, ListItemNode, CodeNode],
  onError: (error: Error) => {
    console.error('Lexical Editor Error:', error);
  },
  theme: editorTheme,
};

interface CleanLexicalEditorProps {
  documentId: string;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

// Toolbar Component
function EditorToolbar() {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const updateFormats = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const formats = new Set<string>();
      if (selection.hasFormat('bold')) formats.add('bold');
      if (selection.hasFormat('italic')) formats.add('italic');
      if (selection.hasFormat('underline')) formats.add('underline');
      setActiveFormats(formats);
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateFormats();
      });
    });
  }, [editor, updateFormats]);

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        if ($isHeadingNode(anchorNode)) {
          anchorNode.replace($createHeadingNode(headingSize));
        } else {
          selection.insertNodes([$createHeadingNode(headingSize)]);
        }
      }
    });
  };

  const insertList = (listType: 'bullet' | 'number') => {
    if (listType === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/20">
      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        className="h-8 w-8 p-0"
        title="Rückgängig"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        className="h-8 w-8 p-0"
        title="Wiederholen"
      >
        <Redo className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      {/* Text Formatting */}
      <Button
        variant={activeFormats.has('bold') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => formatText('bold')}
        className="h-8 w-8 p-0"
        title="Fett"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant={activeFormats.has('italic') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => formatText('italic')}
        className="h-8 w-8 p-0"
        title="Kursiv"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant={activeFormats.has('underline') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => formatText('underline')}
        className="h-8 w-8 p-0"
        title="Unterstrichen"
      >
        <Underline className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      {/* Headings */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => formatHeading('h1')}
        className="h-8 w-8 p-0"
        title="Überschrift 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => formatHeading('h2')}
        className="h-8 w-8 p-0"
        title="Überschrift 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => formatHeading('h3')}
        className="h-8 w-8 p-0"
        title="Überschrift 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      {/* Lists */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => insertList('bullet')}
        className="h-8 w-8 p-0"
        title="Aufzählung"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => insertList('number')}
        className="h-8 w-8 p-0"
        title="Nummerierte Liste"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Enhanced Collaboration Awareness Display with Debugging
function CollaborationAwareness() {
  const { yjsDocMap } = useCollaborationContext();
  const [connectedUsers, setConnectedUsers] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Initializing...');
  const [synced, setSynced] = useState<boolean>(false);
  const [userList, setUserList] = useState<string[]>([]);

  useEffect(() => {
    console.log('🔗 CollaborationAwareness: yjsDocMap size:', yjsDocMap.size);
    
    if (yjsDocMap.size === 0) {
      console.log('🔗 CollaborationAwareness: No documents in map');
      setConnectionStatus('Initializing...');
      setConnectedUsers(0);
      setSynced(false);
      setUserList([]);
      return;
    }

    // Get the first document and its provider
    const firstDoc = Array.from(yjsDocMap.values())[0];
    const docWithProvider = firstDoc as Y.Doc & { provider?: WebsocketProvider };
    
    console.log('🔗 CollaborationAwareness: Document found, checking provider');
    
    if (docWithProvider && docWithProvider.provider) {
      const provider = docWithProvider.provider;
      console.log('🔗 CollaborationAwareness: Provider found, wsconnected:', provider.wsconnected);
      
      if (provider.awareness) {
        const updateAwareness = () => {
          const states = provider.awareness.getStates();
          const users: string[] = [];
          
          states.forEach((state: any) => {
            if (state.user && state.user.name) {
              users.push(state.user.name);
            }
          });
          
          setConnectedUsers(states.size);
          setUserList(users);
          
          const status = provider.wsconnected ? 'Connected' : 'Connecting...';
          setConnectionStatus(status);
          
          console.log('🔗 Awareness Update:', {
            connectedUsers: states.size,
            users: users,
            wsConnected: provider.wsconnected,
            status: status
          });
        };

        const updateSync = () => {
          setSynced(provider.synced || false);
          console.log('🔗 Sync Status:', provider.synced);
        };

        // Register event listeners
        provider.awareness.on('change', updateAwareness);
        provider.on('status', (event: any) => {
          console.log('🔗 Provider Status Event:', event);
          updateAwareness();
          updateSync();
        });
        provider.on('sync', updateSync);
        
        // Initial update
        updateAwareness();
        updateSync();

        return () => {
          console.log('🔗 CollaborationAwareness: Cleaning up event listeners');
          provider.awareness.off('change', updateAwareness);
          provider.off('status', updateAwareness);
          provider.off('sync', updateSync);
        };
      }
    }
  }, [yjsDocMap]);

  const getStatusColor = () => {
    if (connectionStatus === 'Connected' && synced) return 'text-green-600';
    if (connectionStatus === 'Connected') return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (connectionStatus === 'Connected' && synced) return '🟢';
    if (connectionStatus === 'Connected') return '🟡';
    return '🔴';
  };

  return (
    <div className="flex items-center gap-2 px-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <span className="text-xs">{getStatusIcon()}</span>
          <span className={`text-sm ${getStatusColor()}`}>
            {connectionStatus}
          </span>
          {synced && <span className="text-xs text-green-600">(synced)</span>}
        </div>
        {connectedUsers > 0 && (
          <div className="text-xs text-muted-foreground">
            {connectedUsers} user{connectedUsers !== 1 ? 's' : ''}
            {userList.length > 0 && `: ${userList.join(', ')}`}
          </div>
        )}
      </div>
    </div>
  );
}

export function CleanLexicalEditor({ 
  documentId,
  placeholder = "Beginnen Sie zu schreiben...", 
  readOnly = false,
  autoFocus = false 
}: CleanLexicalEditorProps) {
  const { session } = useAuth();

  // Debug-Log beim Mounten der Komponente
  useEffect(() => {
    console.log('🚀 CleanLexicalEditor MOUNTED with documentId:', documentId);
    return () => console.log('🔥 CleanLexicalEditor UNMOUNTED');
  }, []);

  useEffect(() => {
    console.log('🔄 CleanLexicalEditor documentId changed to:', documentId);
  }, [documentId]);

  if (!documentId) {
    console.log('❌ CleanLexicalEditor: No documentId provided');
    return (
      <div className="relative border border-border rounded-lg bg-background min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Kein Dokument ausgewählt.</div>
        </div>
      </div>
    );
  }

  console.log('✅ CleanLexicalEditor: Rendering with documentId:', documentId);

  // Enhanced provider factory with detailed debugging
  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Y.Doc>) => {
    console.log('🏭 ProviderFactory: Called with document ID:', id);
    console.log('🏭 ProviderFactory: Current yjsDocMap size:', yjsDocMap.size);
    console.log('🏭 ProviderFactory: Documents in map:', Array.from(yjsDocMap.keys()));
    
    // Create or get the Yjs document
    let doc = yjsDocMap.get(id);
    if (!doc) {
      console.log('🏭 ProviderFactory: Creating new Yjs document');
      doc = new Y.Doc();
      yjsDocMap.set(id, doc);
      console.log('✅ ProviderFactory: Document added to map, new size:', yjsDocMap.size);
    } else {
      console.log('🏭 ProviderFactory: Using existing Yjs document');
    }
    
    // Verify document is in map
    if (yjsDocMap.has(id)) {
      console.log('✅ ProviderFactory: Document confirmed in map');
    } else {
      console.error('❌ ProviderFactory: Document NOT found in map after setting!');
    }
    
    // Create WebSocket provider with detailed logging
    const wsUrl = 'wss://wawofclbehbkebjivdte.supabase.co/functions/v1/yjs-collaboration';
    console.log('🏭 ProviderFactory: Creating WebSocket provider', { wsUrl, roomId: id });
    
    const provider = new WebsocketProvider(wsUrl, id, doc);

    // Enhanced event logging with correct event names
    provider.on('status', (event: any) => {
      console.log('🌐 WebSocket Status:', event);
    });

    provider.on('connection-close', (event: any) => {
      console.log('🌐 WebSocket: Connection closed for document:', id, event);
    });

    provider.on('connection-error', (event: any) => {
      console.error('🌐 WebSocket: Connection error for document:', id, event);
    });

    provider.on('sync', (isSynced: boolean) => {
      console.log('🔄 Document sync status:', isSynced ? 'Synced' : 'Not synced', 'for document:', id);
    });

    // Log when WebSocket connects (using status event)
    if (provider.ws) {
      provider.ws.addEventListener('open', () => {
        console.log('🌐 WebSocket: Connection opened for document:', id);
      });
    }

    // Set user awareness with detailed logging
    if (session?.user && provider.awareness) {
      const userInfo = {
        name: session.user.email || 'Anonymous',
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        clientId: provider.awareness.clientID,
      };
      
      provider.awareness.setLocalStateField('user', userInfo);
      console.log('👤 User awareness set:', userInfo);

      // Log awareness changes
      provider.awareness.on('change', (changes: any) => {
        console.log('👥 Awareness changed:', changes);
        const states = provider.awareness.getStates();
        console.log('👥 Current awareness states:', Array.from(states.entries()));
      });
    }

    // Enhanced Yjs document event logging
    doc.on('update', (update: Uint8Array, origin: any) => {
      console.log('📝 Document updated:', {
        updateSize: update.length,
        origin: origin,
        documentId: id
      });
    });

    doc.on('beforeTransaction', (tr: any, doc: Y.Doc) => {
      console.log('🔄 Before transaction:', tr, 'on document:', id);
    });

    doc.on('afterTransaction', (tr: any, doc: Y.Doc) => {
      console.log('✅ After transaction:', tr, 'on document:', id);
    });

    // Store provider on doc for awareness access
    (doc as any).provider = provider;
    
    console.log('🏭 ProviderFactory: Returning WebsocketProvider as Provider for:', id);
    
    // Return WebsocketProvider directly, casting to Provider type
    return provider as unknown as Provider;
  }, [session?.user]);

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className="relative border border-border rounded-lg bg-background">
        {!readOnly && (
          <div className="flex items-center justify-between border-b border-border p-2">
            <EditorToolbar />
            <CollaborationAwareness />
          </div>
        )}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="min-h-[400px] p-4 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none text-foreground"
                style={{ caretColor: 'currentColor' }}
                spellCheck={false}
                readOnly={readOnly}
              />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none select-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      
      {/* CollaborationPlugin with corrected parameters */}
      <CollaborationPlugin
        id={documentId}
        providerFactory={providerFactory}
        shouldBootstrap={true}
      />
      
      {autoFocus && <AutoFocusPlugin />}
      <LinkPlugin />
      <ListPlugin />
    </LexicalComposer>
  );
}