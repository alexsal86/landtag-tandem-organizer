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
import { MarkNode } from '@lexical/mark';
import { CommentMarkNode } from './plugins/CommentPlugin';
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
import { EnhancedTablePlugin } from './plugins/EnhancedTablePlugin';
import { EnhancedLinkPlugin } from './plugins/EnhancedLinkPlugin';
import { DraggableBlocksPlugin } from './plugins/DraggableBlocksPlugin';
import { MentionsPlugin } from './plugins/MentionsPlugin';
import { CheckListPlugin } from './plugins/CheckListPlugin';
import { ImagePlugin } from './plugins/ImagePlugin';
import { FileAttachmentPlugin } from './plugins/FileAttachmentPlugin';
import { CommentPlugin } from './plugins/CommentPlugin';
import { VersionHistoryPlugin } from './plugins/VersionHistoryPlugin';
import { EnhancedLexicalToolbar } from './EnhancedLexicalToolbar';

// Feature flag for Yjs collaboration
const ENABLE_YJS_COLLABORATION = true;

interface EnhancedLexicalEditorProps {
  content: string;
  contentNodes?: string; // JSON string of serialized editor state
  onChange: (content: string, contentNodes?: string) => void;
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

  const handleFormatText = useCallback((format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }, [editor]);

  const handleElementFormat = useCallback((format: string) => {
    switch (format) {
      case 'heading1':
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const heading = $createHeadingNode('h1');
            selection.insertNodes([heading]);
          }
        });
        break;
      case 'heading2':
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const heading = $createHeadingNode('h2');
            selection.insertNodes([heading]);
          }
        });
        break;
      case 'heading3':
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const heading = $createHeadingNode('h3');
            selection.insertNodes([heading]);
          }
        });
        break;
      case 'paragraph':
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const paragraph = $createParagraphNode();
            selection.insertNodes([paragraph]);
          }
        });
        break;
      case 'bulletlist':
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        break;
      case 'numberlist':
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        break;
      case 'quote':
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const quote = $createQuoteNode();
            selection.insertNodes([quote]);
          }
        });
        break;
      case 'code':
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const code = $createCodeNode();
            selection.insertNodes([code]);
          }
        });
        break;
    }
  }, [editor]);

  const formatButtons = [
    { format: 'bold', icon: Bold, label: 'Fett', action: () => handleFormatText('bold') },
    { format: 'italic', icon: Italic, label: 'Kursiv', action: () => handleFormatText('italic') },
    { format: 'heading1', icon: Heading1, label: 'Überschrift 1', action: () => handleElementFormat('heading1') },
    { format: 'heading2', icon: Heading2, label: 'Überschrift 2', action: () => handleElementFormat('heading2') },
    { format: 'heading3', icon: Heading3, label: 'Überschrift 3', action: () => handleElementFormat('heading3') },
    { format: 'bulletlist', icon: List, label: 'Liste', action: () => handleElementFormat('bulletlist') },
    { format: 'numberlist', icon: ListOrdered, label: 'Nummerierte Liste', action: () => handleElementFormat('numberlist') },
    { format: 'quote', icon: Quote, label: 'Zitat', action: () => handleElementFormat('quote') },
    { format: 'code', icon: Code, label: 'Code', action: () => handleElementFormat('code') },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-3 border-b border-border bg-background">
      {formatButtons.map(({ format, icon: Icon, label, action }) => {
        const isActive = activeFormats.includes(format);
        return (
          <Button
            key={format}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={action}
            title={label}
            className="h-8 w-8 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
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

// Content Plugin to initialize editor with content (with JSON support)
function ContentPlugin({ content, contentNodes }: { content: string; contentNodes?: string }) {
  const [editor] = useLexicalComposerContext();
  
  React.useEffect(() => {
    // Try to restore from serialized editor state first
    if (contentNodes && editor) {
      try {
        const parsedState = JSON.parse(contentNodes);
        if (parsedState && typeof parsedState === 'object') {
          const newEditorState = editor.parseEditorState(parsedState);
          editor.setEditorState(newEditorState);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse content nodes, falling back to plain text:', error);
      }
    }
    
    // Fallback to plain text initialization
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
  }, [editor, content, contentNodes]);

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
  onContentChange: (content: string, contentNodes?: string) => void;
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
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 0);
        }
      });
    }
  }, [editor, remoteContent]);

  // Handle local content changes with JSON serialization
  const handleLocalContentChange = useCallback((editorState: EditorState) => {
    if (isRemoteUpdateRef.current) {
      console.log('🚫 Skipping local change handler - remote update in progress');
      return;
    }
    
    editorState.read(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      
      // Generate serialized editor state for persistence
      let serializedState = null;
      try {
        serializedState = JSON.stringify(editorState.toJSON());
      } catch (error) {
        console.warn('Failed to serialize editor state:', error);
      }
      
      if (textContent !== lastContentRef.current) {
        console.log('📝 Local content change detected:', textContent);
        lastContentRef.current = textContent;
        onContentChange(textContent, serializedState);
        
        setTimeout(() => {
          if (lastContentRef.current === textContent) {
            console.log('📡 Sending content update to collaboration:', textContent);
            sendContentUpdate(textContent, serializedState);
          }
        }, 300);
      }
    });
  }, [onContentChange, sendContentUpdate]);

  return <OnChangePlugin onChange={handleLocalContentChange} />;
}

// YJS Collaboration Editor Component
function YjsCollaborationEditor({
  content,
  contentNodes,
  onChange,
  placeholder,
  documentId,
  showToolbar
}: {
  content: string;
  contentNodes?: string;
  onChange: (content: string, contentNodes?: string) => void;
  placeholder?: string;
  documentId: string;
  showToolbar?: boolean;
}) {
  const initialConfig = useMemo(() => ({
    namespace: 'YjsCollaborationEditor',
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
      tableRow: 'border-b border-border'
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      HashtagNode,
      MarkNode,
      CommentMarkNode
    ],
    onError: (error: Error) => {
      console.error('Lexical Error:', error);
    }
  }), []);

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
          
          <ContentPlugin content={content} contentNodes={contentNodes} />
          <OnChangePlugin onChange={(editorState) => {
            editorState.read(() => {
              const root = $getRoot();
              const textContent = root.getTextContent();
              
              // Generate serialized editor state for persistence
              let serializedState = null;
              try {
                serializedState = JSON.stringify(editorState.toJSON());
              } catch (error) {
                console.warn('Failed to serialize editor state:', error);
              }
              
              onChange(textContent, serializedState);
            });
          }} />
          
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <KeyboardShortcutsPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <TabIndentationPlugin />
        </div>
      </LexicalComposer>
    </div>
  );
}

export default function EnhancedLexicalEditor({
  content, 
  contentNodes,
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
      CodeNode,
      CodeHighlightNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      HashtagNode,
      MarkNode,
      CommentMarkNode
    ],
    onError: (error: Error) => {
      console.error('Lexical Error:', error);
    }
  }), []);

  const handleContentChange = useCallback((content: string, contentNodes?: string) => {
    setLocalContent(content);
    onChange(content, contentNodes);
  }, [onChange]);

  const handleYjsContentSync = useCallback((content: string, contentNodes?: string) => {
    setLocalContent(content);
    onChange(content, contentNodes);
  }, [onChange]);

  // Initialize content
  React.useEffect(() => {
    if (content !== localContent) {
      setLocalContent(content);
    }
  }, [content]);

  // Handle Yjs collaboration if enabled
  if (enableCollaboration && useYjsCollaboration && documentId) {
    return (
      <YjsProvider documentId={documentId}>
        <YjsCollaborationEditor
          content={content}
          contentNodes={contentNodes}
          onChange={handleYjsContentSync}
          placeholder={placeholder}
          documentId={documentId}
          showToolbar={showToolbar}
        />
      </YjsProvider>
    );
  }

  // Render regular Lexical editor
  return (
    <div className="relative min-h-[200px] border rounded-md overflow-hidden">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="editor-inner relative">
          {showToolbar && <ToolbarPlugin />}
          
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
          
          <ContentPlugin content={content} contentNodes={contentNodes} />
          {enableCollaboration && (
            <CollaborationPlugin
              documentId={documentId || 'default'}
              onContentChange={handleContentChange}
              sendContentUpdate={realtimeCollaboration.sendContentUpdate}
              remoteContent={remoteContent}
            />
          )}
          {!enableCollaboration && <OnChangePlugin onChange={(editorState) => {
            editorState.read(() => {
              const root = $getRoot();
              const textContent = root.getTextContent();
              
              // Generate serialized editor state for persistence
              let serializedState = null;
              try {
                serializedState = JSON.stringify(editorState.toJSON());
              } catch (error) {
                console.warn('Failed to serialize editor state:', error);
              }
              
              handleContentChange(textContent, serializedState);
            });
          }} />}
          
          {/* Enhanced Plugins */}
          <EnhancedTablePlugin />
          <EnhancedLinkPlugin />
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
        </div>
      </LexicalComposer>
    </div>
  );
}