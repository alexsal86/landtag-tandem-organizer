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
import { createBinding } from '@lexical/yjs';

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

// Simplified Collaboration Awareness Display
function CollaborationAwareness() {
  const { yjsDocMap } = useCollaborationContext();
  const [connectedUsers, setConnectedUsers] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');

  useEffect(() => {
    if (yjsDocMap.size === 0) {
      setConnectionStatus('Connecting...');
      setConnectedUsers(0);
      return;
    }

    // Get the first document and its provider
    const firstDoc = Array.from(yjsDocMap.values())[0];
    const docWithProvider = firstDoc as Y.Doc & { provider?: WebsocketProvider };
    
    if (docWithProvider && docWithProvider.provider) {
      const provider = docWithProvider.provider;
      
      if (provider.awareness) {
        const updateAwareness = () => {
          const states = provider.awareness.getStates();
          setConnectedUsers(states.size);
          setConnectionStatus(provider.wsconnected ? 'Connected' : 'Connecting...');
        };

        provider.awareness.on('change', updateAwareness);
        provider.on('status', updateAwareness);
        updateAwareness();

        return () => {
          provider.awareness.off('change', updateAwareness);
          provider.off('status', updateAwareness);
        };
      }
    }
  }, [yjsDocMap]);

  return (
    <div className="flex items-center gap-2 px-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        {connectionStatus} {connectedUsers > 0 && `(${connectedUsers} users)`}
      </span>
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

  if (!documentId) {
    return (
      <div className="relative border border-border rounded-lg bg-background min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Kein Dokument ausgewählt.</div>
        </div>
      </div>
    );
  }

  // Provider factory that creates Yjs binding for CollaborationPlugin
  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Y.Doc>) => {
    const doc = new Y.Doc();
    yjsDocMap.set(id, doc);
    
    // Create WebSocket provider for collaboration
    // Base URL without documentId - WebsocketProvider adds the room name automatically
    const provider = new WebsocketProvider(
      'wss://wawofclbehbkebjivdte.supabase.co/functions/v1/yjs-collaboration',
      id, // This becomes the room name
      doc,
      {
        connect: true,
        // Add some retry logic for better reliability
        resyncInterval: 5000,
      }
    );
    
    // Set user awareness
    const awareness = provider.awareness;
    if (session?.user && awareness) {
      awareness.setLocalStateField('user', {
        name: session.user.email || 'Anonymous',
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        clientId: awareness.clientID
      });
    }
    
    // Add connection event logging for debugging
    provider.on('status', ({ status }: { status: string }) => {
      console.log('WebSocket provider status:', status);
    });
    
    provider.on('connection-error', (event: Event, provider: WebsocketProvider) => {
      console.error('WebSocket connection error:', event);
    });
    
    // Store provider on doc for awareness access
    const docWithProvider = doc as Y.Doc & { provider: WebsocketProvider };
    docWithProvider.provider = provider;
    
    // Return the provider - CollaborationPlugin will create the binding internally using createBinding
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
      
      {/* Official CollaborationPlugin */}
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