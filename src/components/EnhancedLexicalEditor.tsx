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
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HashtagNode } from '@lexical/hashtag';
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
import { ManualYjsCollaborationPlugin } from './collaboration/ManualYjsCollaborationPlugin';
import { YjsSyncStatus } from './collaboration/YjsSyncStatus';
import FloatingTextFormatToolbar from './FloatingTextFormatToolbar';
import { Button } from './ui/button';
import { Bold, Italic, List, ListOrdered, Quote, Code, Heading1, Heading2, Heading3 } from 'lucide-react';

// Import new plugins
import { TablePlugin } from './plugins/TablePlugin';
import { LinkPlugin as CustomLinkPlugin } from './plugins/LinkPlugin';
import { DraggableBlocksPlugin } from './plugins/DraggableBlocksPlugin';
import { MentionsPlugin } from './plugins/MentionsPlugin';
import { CheckListPlugin } from './plugins/CheckListPlugin';
import { ImagePlugin } from './plugins/ImagePlugin';
import { FileAttachmentPlugin } from './plugins/FileAttachmentPlugin';
import { AdvancedCursorPlugin } from './plugins/AdvancedCursorPlugin';
import { CommentPlugin } from './plugins/CommentPlugin';
import { VersionHistoryPlugin } from './plugins/VersionHistoryPlugin';
import { EnhancedLexicalToolbar } from './EnhancedLexicalToolbar';
import { CollaborationDashboard } from './collaboration/CollaborationDashboard';

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
  onConnectionChange?: (connected: boolean) => void;
}

// Toolbar Plugin with formatting commands
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<string[]>([]);

  // Track selection and active formats
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        const formats: string[] = [];
        
        if ($isRangeSelection(selection)) {
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
    } else if (format === 'codeblock') {
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
    <div className="border-b border-border bg-background">
      <div className="flex flex-wrap gap-1 p-3">
        {/* Text Formatierung */}
        <div className="flex gap-1 mr-4">
          {[
            { format: 'bold', label: 'Fett', icon: '𝐁' },
            { format: 'italic', label: 'Kursiv', icon: '𝑰' },
            { format: 'underline', label: 'Unterstrichen', icon: 'U̲' },
            { format: 'strikethrough', label: 'Durchgestrichen', icon: 'S̶' },
            { format: 'code', label: 'Code', icon: '</>' }
          ].map(({ format, label, icon }) => (
            <button
              key={format}
              onClick={() => onFormatText(format)}
              className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                activeFormats.includes(format) 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Block Formatierung */}
        <div className="flex gap-1 mr-4">
          {[
            { format: 'heading1', label: 'Überschrift 1', icon: 'H1' },
            { format: 'heading2', label: 'Überschrift 2', icon: 'H2' },
            { format: 'heading3', label: 'Überschrift 3', icon: 'H3' },
            { format: 'quote', label: 'Zitat', icon: '❝' },
            { format: 'codeblock', label: 'Code Block', icon: '{ }' }
          ].map(({ format, label, icon }) => (
            <button
              key={format}
              onClick={() => onFormatText(format)}
              className="px-2 py-1 rounded text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Listen */}
        <div className="flex gap-1">
          {[
            { format: 'bulletlist', label: 'Aufzählung', icon: '•' },
            { format: 'numberlist', label: 'Nummerierte Liste', icon: '1.' }
          ].map(({ format, label, icon }) => (
            <button
              key={format}
              onClick={() => onFormatText(format)}
              className="px-2 py-1 rounded text-sm font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
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

// Clean Yjs Collaboration Editor component  
function YjsCollaborationEditor(props: any) {
  const yjsProvider = useYjsProvider();
  const [showCollabDashboard, setShowCollabDashboard] = React.useState(true);
  
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
      
      {/* Collaboration Dashboard */}
      <CollaborationDashboard
        documentId={props.documentId}
        isVisible={showCollabDashboard}
        onToggle={() => setShowCollabDashboard(!showCollabDashboard)}
      />
      
      <YjsSyncStatus>
        <LexicalComposer 
          initialConfig={props.initialConfig}
          key={`yjs-editor-${props.documentId}`}
        >
          <div className="editor-inner relative">
            {props.showToolbar && <EnhancedLexicalToolbar documentId={props.documentId} />}
            
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
              
              {/* Advanced Collaboration Features */}
              <AdvancedCursorPlugin />
            </div>
            
            <ManualYjsCollaborationPlugin
              documentId={props.documentId}
              shouldBootstrap={true}
            />
            
            <YjsContentSyncPlugin
              initialContent={props.initialContent}
              onContentSync={props.onContentSync}
              documentId={props.documentId}
            />
            
            {/* Enhanced Plugins */}
            <TablePlugin />
            <CustomLinkPlugin />
            <DraggableBlocksPlugin />
            <MentionsPlugin />
            <CheckListPlugin />
            <ImagePlugin />
            <FileAttachmentPlugin />
            <CommentPlugin documentId={props.documentId} />
            <VersionHistoryPlugin documentId={props.documentId} />
            
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
  showToolbar = true,
  onConnectionChange
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

  const initialConfig = useMemo(() => ({
    namespace: 'EnhancedEditor',
    theme: {
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        code: 'bg-muted px-1 rounded text-sm font-mono'
      },
      heading: {
        h1: 'text-2xl font-bold mt-4 mb-2',
        h2: 'text-xl font-bold mt-3 mb-2',
        h3: 'text-lg font-bold mt-3 mb-1'
      },
      quote: 'border-l-4 border-primary pl-4 italic my-2',
      code: 'bg-muted p-2 rounded font-mono text-sm block my-2',
      list: {
        ul: 'list-disc list-outside ml-4',
        ol: 'list-decimal list-outside ml-4'
      },
      table: 'border-collapse border border-border',
      tableCell: 'border border-border p-2',
      tableRow: 'border-b border-border',
      hashtag: 'text-primary font-medium'
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
      TableNode,
      TableCellNode,
      TableRowNode,
      HashtagNode
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    }
  }), []);

  const handleContentChange = useCallback((newContent: string) => {
    setLocalContent(newContent);
    onChange(newContent);
  }, [onChange]);

  const sendContentUpdate = useCallback((content: string) => {
    if (realtimeCollaboration?.sendContentUpdate) {
      realtimeCollaboration.sendContentUpdate(content);
    }
  }, [realtimeCollaboration]);

  const handleYjsContentSync = useCallback((content: string) => {
    setLocalContent(content);
    onChange(content);
  }, [onChange]);

  // Render Yjs collaboration editor
  if (shouldUseYjs && documentId) {
    return (
      <YjsProvider 
        documentId={documentId}
        onConnected={() => console.log('[YjsEditor] Connected to collaboration')}
        onDisconnected={() => console.log('[YjsEditor] Disconnected from collaboration')}
      >
        <YjsCollaborationEditor
          initialConfig={initialConfig}
          placeholder={placeholder}
          documentId={documentId}
          showToolbar={showToolbar}
          initialContent={content}
          onContentSync={handleYjsContentSync}
        />
      </YjsProvider>
    );
  }

  // Render regular Lexical editor
  return (
    <div className="relative min-h-[200px] border rounded-md overflow-hidden">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="editor-inner relative">
          {showToolbar && <EnhancedLexicalToolbar />}
          
          <div className="relative">
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
            <FloatingTextFormatToolbar />
          </div>
          
          <CollaborationPlugin
            documentId={documentId || 'default'}
            onContentChange={setLocalContent}
            sendContentUpdate={realtimeCollaboration.sendContentUpdate}
            remoteContent={remoteContent}
          />
          
          {/* Enhanced Plugins */}
          <TablePlugin />
          <CustomLinkPlugin />
          <DraggableBlocksPlugin />
          <MentionsPlugin />
          <CheckListPlugin />
          <ImagePlugin />
          <FileAttachmentPlugin />
          <CommentPlugin documentId={documentId} />
          <VersionHistoryPlugin documentId={documentId} />
          
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <KeyboardShortcutsPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <TabIndentationPlugin />
          {enableCollaboration && <CollaborationStatus isConnected={realtimeCollaboration.isConnected} users={realtimeCollaboration.collaborators} />}
        </div>
      </LexicalComposer>
    </div>
  );
}