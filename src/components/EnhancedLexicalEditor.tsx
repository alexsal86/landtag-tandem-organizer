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

// Import JSON serialization functions from Lexical
import { $generateHtmlFromNodes } from '@lexical/html';

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
import { OfficialLexicalYjsPlugin, YjsCollaboratorsList } from './collaboration/OfficialLexicalYjsPlugin';
import { YjsSyncStatus } from './collaboration/YjsSyncStatus';
import { sanitizeContent, parseContentSafely, createDebouncedContentUpdate, areContentsEquivalent } from '@/utils/contentValidation';
import FloatingTextFormatToolbar from './FloatingTextFormatToolbar';
import { Button } from './ui/button';
import { Bold, Italic, List, ListOrdered, Quote, Code, Heading1, Heading2, Heading3 } from 'lucide-react';

// Import new plugins
import { EnhancedTablePlugin } from './plugins/EnhancedTablePlugin';
import { FixedTablePlugin } from './plugins/FixedTablePlugin';
import { ImprovedTablePlugin } from './plugins/ImprovedTablePlugin';
import { EnhancedLinkPlugin } from './plugins/EnhancedLinkPlugin';
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
  contentNodes?: string; // JSON serialized EditorState
  onChange: (content: string, contentNodes?: string) => void;
  placeholder?: string;
  documentId?: string;
  enableCollaboration?: boolean;
  useYjsCollaboration?: boolean;
  showToolbar?: boolean;
  readOnly?: boolean;
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
          const selectedText = selection.getTextContent();
          const headingNode = $createHeadingNode('h1');
          
          if (selectedText) {
            headingNode.append($createTextNode(selectedText));
            selection.insertNodes([headingNode]);
          } else {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getParent() || anchorNode;
            if (element) {
              const textContent = element.getTextContent();
              headingNode.append($createTextNode(textContent));
              element.replace(headingNode);
            }
          }
        }
      });
    } else if (format === 'heading2') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const selectedText = selection.getTextContent();
          const headingNode = $createHeadingNode('h2');
          
          if (selectedText) {
            headingNode.append($createTextNode(selectedText));
            selection.insertNodes([headingNode]);
          } else {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getParent() || anchorNode;
            if (element) {
              const textContent = element.getTextContent();
              headingNode.append($createTextNode(textContent));
              element.replace(headingNode);
            }
          }
        }
      });
    } else if (format === 'heading3') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const selectedText = selection.getTextContent();
          const headingNode = $createHeadingNode('h3');
          
          if (selectedText) {
            headingNode.append($createTextNode(selectedText));
            selection.insertNodes([headingNode]);
          } else {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getParent() || anchorNode;
            if (element) {
              const textContent = element.getTextContent();
              headingNode.append($createTextNode(textContent));
              element.replace(headingNode);
            }
          }
        }
      });
    } else if (format === 'quote') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const selectedText = selection.getTextContent();
          const quoteNode = $createQuoteNode();
          
          if (selectedText) {
            quoteNode.append($createParagraphNode().append($createTextNode(selectedText)));
            selection.insertNodes([quoteNode]);
          } else {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getParent() || anchorNode;
            if (element) {
              const textContent = element.getTextContent();
              quoteNode.append($createParagraphNode().append($createTextNode(textContent)));
              element.replace(quoteNode);
            }
          }
        }
      });
    } else if (format === 'codeblock') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const selectedText = selection.getTextContent();
          const codeNode = $createCodeNode();
          
          if (selectedText) {
            codeNode.append($createTextNode(selectedText));
            selection.insertNodes([codeNode]);
          } else {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getParent() || anchorNode;
            if (element) {
              const textContent = element.getTextContent();
              codeNode.append($createTextNode(textContent));
              element.replace(codeNode);
            }
          }
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

// Content Plugin to sync content using safe parsing
function ContentPlugin({ content, contentNodes }: { content: string; contentNodes?: string }) {
  const [editor] = useLexicalComposerContext();
  
  React.useEffect(() => {
    if (!editor) return;

    // Use safe content parsing to prevent corruption
    const { plainText, jsonNodes } = parseContentSafely(content, contentNodes);
    
    // Priority: JSON contentNodes > plain text content
    if (jsonNodes && jsonNodes.trim()) {
      try {
        // Use official Lexical parseEditorState method
        const editorState = editor.parseEditorState(jsonNodes);
        editor.setEditorState(editorState);
        console.log('📄 [ContentPlugin] Successfully loaded from validated JSON contentNodes');
        return;
      } catch (error) {
        console.warn('Failed to parse contentNodes JSON, falling back to plain text:', error);
      }
    }
    
    // Fallback to plain text content
    if (plainText && plainText.trim()) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(plainText));
        root.append(paragraph);
      });
      console.log('📄 [ContentPlugin] Loaded from validated plain text content');
    } else {
      // Initialize with empty content
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      });
      console.log('📄 [ContentPlugin] Initialized with empty content');
    }
  }, [editor, content, contentNodes]);

  return null;
}

// Collaboration Plugin for Supabase Realtime (enhanced with safe serialization)
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
  
  // Create debounced update function to prevent race conditions
  const debouncedSendUpdate = useRef(
    createDebouncedContentUpdate((content: string, contentNodes?: string) => {
      if (!isRemoteUpdateRef.current) {
        console.log('📡 Sending debounced content update to collaboration:', content);
        sendContentUpdate(content, contentNodes);
      }
    }, 300)
  );

  // Handle remote content changes with validation
  React.useEffect(() => {
    if (remoteContent && !areContentsEquivalent(remoteContent, lastContentRef.current)) {
      console.log('📝 Applying remote content to editor:', remoteContent);
      
      // Validate and sanitize remote content
      const { plainText } = parseContentSafely(remoteContent);
      
      isRemoteUpdateRef.current = true;
      
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        
        if (plainText.trim()) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(plainText));
          root.append(paragraph);
        }
        
        lastContentRef.current = plainText;
      }, {
        onUpdate: () => {
          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 100);
        }
      });
    }
  }, [editor, remoteContent]);

  // Handle local content changes with safe serialization
  const handleLocalContentChange = useCallback((editorState: EditorState) => {
    if (isRemoteUpdateRef.current) {
      console.log('🚫 Skipping local change handler - remote update in progress');
      return;
    }
    
    editorState.read(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      
      // Only proceed if content actually changed
      if (!areContentsEquivalent(textContent, lastContentRef.current)) {
        console.log('📝 Local content change detected:', textContent);
        lastContentRef.current = textContent;
        
        // Safe JSON serialization
        let jsonContent: string | undefined;
        try {
          jsonContent = JSON.stringify(editorState.toJSON());
        } catch (error) {
          console.warn('JSON serialization failed, using text only:', error);
          jsonContent = undefined;
        }
        
        // Update parent component immediately
        onContentChange(textContent, jsonContent);
        
        // Send to collaboration with debouncing
        debouncedSendUpdate.current(textContent, jsonContent);
      }
    });
  }, [onContentChange]);

  return <OnChangePlugin onChange={handleLocalContentChange} />;
}

// Content Sync Plugin for Yjs (enhanced with safe serialization)
function YjsContentSyncPlugin({ 
  initialContent,
  initialContentNodes,
  onContentSync,
  documentId 
}: { 
  initialContent: string;
  initialContentNodes?: any;
  onContentSync: (content: string, contentNodes?: any) => void;
  documentId: string;
}) {
  const [editor] = useLexicalComposerContext();
  const yjsProvider = useYjsProvider();
  const lastSyncedContentRef = useRef<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load initial content into Yjs when connected and synced
  useEffect(() => {
    if (!yjsProvider?.isSynced || !yjsProvider?.isConnected || hasInitialized) return;
    
    const sharedRoot = yjsProvider.sharedType;
    if (!sharedRoot) return;

    // Only load initial content if Yjs document is empty
    const yjsContent = sharedRoot.toString();
    if (!yjsContent && (initialContent || initialContentNodes)) {
      console.log(`[YjsContentSync] Loading initial content into Yjs document: ${documentId}`);
      
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        
        if (initialContentNodes) {
          try {
            const editorState = editor.parseEditorState(initialContentNodes);
            editor.setEditorState(editorState);
            console.log('[YjsContentSync] Initial content nodes loaded successfully');
            lastSyncedContentRef.current = initialContent;
          } catch (error) {
            console.warn('[YjsContentSync] Failed to parse content nodes, using plain text:', error);
            if (initialContent && initialContent.trim()) {
              const paragraph = $createParagraphNode();
              paragraph.append($createTextNode(initialContent));
              root.append(paragraph);
            }
            lastSyncedContentRef.current = initialContent;
          }
        } else if (initialContent && initialContent.trim()) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(initialContent));
          root.append(paragraph);
          console.log('[YjsContentSync] Initial plain text content loaded');
          lastSyncedContentRef.current = initialContent;
        }
      });
      
      setHasInitialized(true);
    } else if (yjsContent) {
      console.log('[YjsContentSync] Yjs document already has content, skipping initial load');
      setHasInitialized(true);
      lastSyncedContentRef.current = yjsContent;
    }
  }, [yjsProvider?.isSynced, yjsProvider?.isConnected, editor, initialContent, initialContentNodes, hasInitialized, documentId]);

  // Debounced sync to parent component (for auto-save)
  useEffect(() => {
    if (!yjsProvider?.isSynced || !onContentSync) return;

    let timeoutId: NodeJS.Timeout;
    
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        editorState.read(() => {
          const root = $getRoot();
          const currentContent = root.getTextContent();
          const jsonContent = JSON.stringify(editorState.toJSON());
          
          if (currentContent !== lastSyncedContentRef.current) {
            console.log(`[YjsContentSync] Syncing content to parent (debounced): ${documentId}`);
            lastSyncedContentRef.current = currentContent;
            onContentSync(currentContent, jsonContent);
          }
        });
      }, 1000); // Debounce 1 second
    });

    return () => {
      clearTimeout(timeoutId);
      unregister();
    };
  }, [yjsProvider?.isSynced, editor, onContentSync, documentId]);

  return null;
}

// Clean Yjs Collaboration Editor component  
function YjsCollaborationEditor(props: any) {
  const yjsProvider = useYjsProvider();
  const [showCollabDashboard, setShowCollabDashboard] = React.useState(false);
  const [editor] = useLexicalComposerContext();
  
  // Update editor editable state when readOnly prop changes
  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!props.readOnly);
    }
  }, [editor, props.readOnly]);
  
  return (
    <div className="relative min-h-[200px] border rounded-md overflow-hidden">
      {(!yjsProvider?.isSynced || !yjsProvider?.isConnected) && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {!yjsProvider?.isConnected ? 'Verbindung wird hergestellt...' : 'Synchronisierung läuft...'}
          </div>
        </div>
      )}
      
      {/* Collaboration Dashboard - positioned near toolbar */}
      <CollaborationDashboard
        documentId={props.documentId}
        isVisible={showCollabDashboard}
        onToggle={() => setShowCollabDashboard(!showCollabDashboard)}
      />
      
      <YjsSyncStatus>
        <div className="editor-inner relative">
          {props.showToolbar && <EnhancedLexicalToolbar documentId={props.documentId} />}
          
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable 
                  className={`editor-input min-h-[300px] p-4 focus:outline-none resize-none prose prose-sm max-w-none ${
                    props.readOnly ? 'cursor-not-allowed opacity-75' : ''
                  }`}
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
          
          <OfficialLexicalYjsPlugin
            id={props.documentId}
            provider={yjsProvider?.provider}
            doc={yjsProvider?.doc}
            sharedType={yjsProvider?.sharedType}
            shouldBootstrap={true}
          />
          
          <YjsContentSyncPlugin
            initialContent={props.initialContent}
            initialContentNodes={props.initialContentNodes}
            onContentSync={props.onContentSync}
            documentId={props.documentId}
          />
          
          {/* Enhanced Plugins */}
          <FixedTablePlugin />
          <EnhancedTablePlugin />
          <EnhancedLinkPlugin />
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
      </YjsSyncStatus>
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
  readOnly = false,
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
    editable: !readOnly, // Add readOnly support
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
      HashtagNode,
      MarkNode,
      CommentMarkNode
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    }
  }), [readOnly]);

  const handleContentChange = useCallback((newContent: string, newContentNodes?: string) => {
    setLocalContent(newContent);
    onChange(newContent, newContentNodes);
  }, [onChange]);

  const sendContentUpdate = useCallback((content: string, contentNodes?: string) => {
    if (realtimeCollaboration?.sendContentUpdate) {
      realtimeCollaboration.sendContentUpdate(content, contentNodes);
    }
  }, [realtimeCollaboration]);

  const handleYjsContentSync = useCallback((content: string, contentNodes?: string) => {
    setLocalContent(content);
    onChange(content, contentNodes);
  }, [onChange]);

  // Render Yjs collaboration editor
  if (shouldUseYjs && documentId) {
    return (
      <YjsProvider 
        documentId={documentId}
        onConnected={() => {
          console.log('[YjsEditor] Connected to collaboration');
          onConnectionChange?.(true);
        }}
        onDisconnected={() => {
          console.log('[YjsEditor] Disconnected from collaboration');
          onConnectionChange?.(false);
        }}
      >
        <LexicalComposer 
          initialConfig={initialConfig}
          key={`yjs-editor-${documentId}`}
        >
          <YjsCollaborationEditor
            initialConfig={initialConfig}
            placeholder={placeholder}
            documentId={documentId}
            showToolbar={showToolbar}
            readOnly={readOnly}
            initialContent={content}
            initialContentNodes={contentNodes}
            onContentSync={handleYjsContentSync}
          />
        </LexicalComposer>
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
          
          {/* Content Serialization - always serialize to JSON */}
          {!enableCollaboration && (
            <OnChangePlugin
              onChange={(editorState) => {
                editorState.read(() => {
                  const root = $getRoot();
                  const plainText = root.getTextContent();
                  const jsonContent = JSON.stringify(editorState.toJSON());
                  handleContentChange(plainText, jsonContent);
                });
              }}
            />
          )}
          
          {/* Collaboration Plugin - handles both local changes and remote updates */}
          {enableCollaboration && (
            <CollaborationPlugin
              documentId={documentId || 'default'}
              onContentChange={handleContentChange}
              sendContentUpdate={sendContentUpdate}
              remoteContent={remoteContent}
            />
          )}
          
          <ContentPlugin content={content} contentNodes={contentNodes} />
          
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
          {enableCollaboration && <CollaborationStatus isConnected={realtimeCollaboration.isConnected} users={realtimeCollaboration.collaborators} />}
        </div>
      </LexicalComposer>
    </div>
  );
}