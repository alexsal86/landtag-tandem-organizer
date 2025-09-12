import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { $getRoot, $getSelection, EditorState, $isRangeSelection, $createRangeSelection, $setSelection } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';

// Lexical nodes
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { 
  $createParagraphNode, 
  $createTextNode,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  TextFormatType
} from 'lexical';
import { 
  INSERT_UNORDERED_LIST_COMMAND, 
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { TRANSFORMERS } from '@lexical/markdown';

import { useCollaboration } from '@/hooks/useCollaboration';
import CollaborationStatus from './CollaborationStatus';
import { YjsProvider, useYjsProvider } from './collaboration/YjsProvider';
import { LexicalYjsCollaborationPlugin } from './collaboration/LexicalYjsCollaborationPlugin';
import { YjsSyncStatus } from './collaboration/YjsSyncStatus';
import FloatingTextFormatToolbar from './FloatingTextFormatToolbar';
import { Button } from './ui/button';
import { Bold, Italic, List, ListOrdered, Quote, Code, Heading1, Heading2, Heading3 } from 'lucide-react';

// Feature flag for Yjs collaboration
const ENABLE_YJS_COLLABORATION = true;

interface EnhancedLexicalEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  documentId?: string;
  enableCollaboration?: boolean;
  useYjsCollaboration?: boolean;
  showToolbar?: boolean;
}

// Toolbar Plugin with formatting commands
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);

  // Track selection and active formats
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        const formats: string[] = [];
        
        if ($isRangeSelection(selection)) {
          const hasText = !selection.isCollapsed();
          setShowFloatingToolbar(hasText);
          
          // Check active text formats
          if (selection.hasFormat('bold')) formats.push('bold');
          if (selection.hasFormat('italic')) formats.push('italic');
          if (selection.hasFormat('underline')) formats.push('underline');
          if (selection.hasFormat('strikethrough')) formats.push('strikethrough');
          if (selection.hasFormat('code')) formats.push('code');
        }
        
        setActiveFormats(formats);
      });
    });
  }, [editor]);

  const handleFormatText = useCallback((format: string) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format as TextFormatType);
  }, [editor]);

  const handleFormatElement = useCallback((format: string) => {
    if (format === 'heading1') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const headingNode = $createHeadingNode('h1');
          selection.insertNodes([headingNode]);
        }
      });
    } else if (format === 'heading2') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const headingNode = $createHeadingNode('h2');
          selection.insertNodes([headingNode]);
        }
      });
    } else if (format === 'heading3') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const headingNode = $createHeadingNode('h3');
          selection.insertNodes([headingNode]);
        }
      });
    } else if (format === 'quote') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const quoteNode = $createQuoteNode();
          selection.insertNodes([quoteNode]);
        }
      });
    } else if (format === 'code') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const codeNode = $createCodeNode();
          selection.insertNodes([codeNode]);
        }
      });
    } else if (format === 'bulletlist') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else if (format === 'numberlist') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  }, [editor]);

  const onFormatText = useCallback((format: string) => {
    if (['bold', 'italic', 'underline', 'strikethrough', 'code'].includes(format)) {
      handleFormatText(format);
    } else {
      handleFormatElement(format);
    }
  }, [handleFormatText, handleFormatElement]);

  return (
    <>
      {/* Fixed Toolbar for Block Formatting */}
      <div className="border-b border-border bg-background">
        <div className="flex flex-wrap gap-1 p-3">
          <span className="text-sm text-muted-foreground">Rich Text Editor - Select text for formatting</span>
        </div>
      </div>
    </>
  );
}

// Keyboard shortcuts plugin
function KeyboardShortcutsPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'b':
            event.preventDefault();
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
            break;
          case 'i':
            event.preventDefault();
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
            break;
          case 'u':
            event.preventDefault();
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  return null;
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

// Collaboration Plugin for Supabase Realtime (enhanced for rich text)
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

// Content Sync Plugin for Yjs (enhanced for rich text)
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
      }, 2000);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [yjsProvider?.isSynced, editor, onContentSync]);

  return null;
}

// Yjs Collaboration Editor component (enhanced for rich text)
function YjsCollaborationEditor(props: any) {
  const yjsProvider = useYjsProvider();
  
  return (
    <div className="relative min-h-[200px] border rounded-md overflow-hidden">
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
            {props.showToolbar && <ToolbarPlugin />}
            
            <div className="relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable 
                    className="editor-input min-h-[300px] p-4 focus:outline-none resize-none prose prose-sm max-w-none" 
                  />
                }
                placeholder={
                  <div className="editor-placeholder absolute top-4 left-4 text-muted-foreground pointer-events-none">
                    {props.placeholder}
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <FloatingTextFormatToolbar />
            </div>
            
            <LexicalYjsCollaborationPlugin
              id={props.documentId}
              shouldBootstrap={true}
            />
            
            <YjsContentSyncPlugin
              initialContent={props.initialContent}
              onContentSync={props.onContentSync}
              documentId={props.documentId}
            />
            
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <KeyboardShortcutsPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <TabIndentationPlugin />
          </div>
        </LexicalComposer>
      </YjsSyncStatus>
    </div>
  );
}

export default function EnhancedLexicalEditor({
  content, 
  onChange, 
  placeholder = "Beginnen Sie zu schreiben...",
  documentId,
  enableCollaboration = false,
  useYjsCollaboration = ENABLE_YJS_COLLABORATION,
  showToolbar = true
}: EnhancedLexicalEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [remoteContent, setRemoteContent] = useState<string>('');
  
  const shouldUseYjs = enableCollaboration && useYjsCollaboration;
  
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

  const collaboration = realtimeCollaboration;

  // Enhanced initial config with rich text nodes
  const initialConfig = useMemo(() => ({
    namespace: 'EnhancedKnowledgeEditor',
    theme: {
      paragraph: 'editor-paragraph',
      text: {
        bold: 'editor-text-bold font-bold',
        italic: 'editor-text-italic italic',
        underline: 'editor-text-underline underline',
        strikethrough: 'editor-text-strikethrough line-through',
        code: 'editor-text-code bg-muted px-1 py-0.5 rounded text-sm font-mono',
      },
      heading: {
        h1: 'text-4xl font-bold mb-4',
        h2: 'text-3xl font-bold mb-3',
        h3: 'text-2xl font-bold mb-2',
        h4: 'text-xl font-bold mb-2',
        h5: 'text-lg font-bold mb-1',
        h6: 'text-base font-bold mb-1',
      },
      list: {
        nested: {
          listitem: 'editor-nested-listitem',
        },
        ol: 'editor-list-ol list-decimal list-inside',
        ul: 'editor-list-ul list-disc list-inside',
        listitem: 'editor-listitem',
      },
      quote: 'editor-quote border-l-4 border-muted-foreground pl-4 italic text-muted-foreground',
      code: 'editor-code bg-muted p-2 rounded font-mono text-sm',
      link: 'editor-link text-primary underline hover:text-primary/80',
    },
    onError: (error: Error) => {
      console.error('Enhanced Lexical Error:', error);
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode,
    ]
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

  useEffect(() => {
    if (!enableCollaboration && content !== localContent) {
      setLocalContent(content);
    }
  }, [content, localContent, enableCollaboration]);

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
        onDisconnected={() => console.log('[Yjs] Disconnected from collaboration')}
        onCollaboratorsChange={(collaborators) => console.log('[Yjs] Collaborators:', collaborators)}
      >
        <div className="editor-container space-y-4">
          <div className="mb-2 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Enhanced Collaboration (Yjs)</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Rich text with auto-sync active
              </div>
            </div>
            <YjsCollaborationStatus />
          </div>

          <YjsCollaborationEditor
            initialConfig={initialConfig}
            documentId={documentId}
            placeholder={placeholder}
            initialContent={content}
            onContentSync={handleYjsContentSync}
            showToolbar={showToolbar}
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
      {enableCollaboration && documentId ? (
        <div className="mb-2 p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium">Enhanced Collaboration (Supabase)</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Rich text with instant sync active
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
            <span className="text-sm font-medium">Enhanced Single User Mode</span>
            <div className="text-xs text-muted-foreground ml-auto">
              Rich text editing active
            </div>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <LexicalComposer 
          initialConfig={initialConfig}
          key={`enhanced-editor-${documentId ?? 'new'}`}
        >
          <div className="editor-inner relative">
            {showToolbar && <ToolbarPlugin />}
            
            <RichTextPlugin
              contentEditable={
                <ContentEditable 
                  className="editor-input min-h-[300px] p-4 focus:outline-none resize-none prose prose-sm max-w-none" 
                />
              }
              placeholder={
                <div className="editor-placeholder absolute top-4 left-4 text-muted-foreground pointer-events-none">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            
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
            <ListPlugin />
            <LinkPlugin />
            <KeyboardShortcutsPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <TabIndentationPlugin />
            
            {!enableCollaboration && (
              <ContentPlugin content={localContent} />
            )}
          </div>
        </LexicalComposer>
      </div>
    </div>
  );
}