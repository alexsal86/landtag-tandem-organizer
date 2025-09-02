import React, { useEffect, useCallback, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { Doc } from 'yjs';

import { 
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  ParagraphNode,
  TextNode
} from 'lexical';
import { 
  HeadingNode,
  QuoteNode,
  $createHeadingNode
} from '@lexical/rich-text';
import { 
  ListNode,
  ListItemNode,
  $createListNode,
  $createListItemNode
} from '@lexical/list';
import { 
  LinkNode,
  AutoLinkNode
} from '@lexical/link';
import { TRANSFORMERS } from '@lexical/markdown';

import { cn } from '@/lib/utils';

// Node types for Lexical
const editorNodes = [
  ParagraphNode,
  TextNode,
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
];

interface LexicalYjsEditorProps {
  documentId: string;
  initialContent?: string;
  onContentChange?: (content: string, html: string) => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

// Custom plugin to handle content changes
function ContentChangePlugin({ 
  onContentChange
}: { 
  onContentChange?: (content: string, html: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    if (!onContentChange) return;

    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        
        // Export as HTML for storage
        const htmlContent = $getRoot().getTextContent(); // Simplified for now
        
        onContentChange(textContent, htmlContent);
      });
    });

    return removeListener;
  }, [editor, onContentChange]);

  return null;
}

// Custom plugin to initialize content from markdown
function InitialContentPlugin({ initialContent }: { initialContent?: string }) {
  const [editor] = useLexicalComposerContext();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!initialContent || hasInitialized.current) return;

    editor.update(() => {
      const root = $getRoot();
      
      // Clear existing content
      root.clear();
      
      // Simple markdown-like parsing for initial content
      const lines = initialContent.split('\n');
      
      lines.forEach((line, index) => {
        if (line.startsWith('# ')) {
          const heading = $createHeadingNode('h1');
          heading.append($createTextNode(line.slice(2)));
          root.append(heading);
        } else if (line.startsWith('## ')) {
          const heading = $createHeadingNode('h2');
          heading.append($createTextNode(line.slice(3)));
          root.append(heading);
        } else if (line.startsWith('### ')) {
          const heading = $createHeadingNode('h3');
          heading.append($createTextNode(line.slice(4)));
          root.append(heading);
        } else if (line.startsWith('- ')) {
          const list = $createListNode('bullet');
          const listItem = $createListItemNode();
          listItem.append($createTextNode(line.slice(2)));
          list.append(listItem);
          root.append(list);
        } else if (line.trim()) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(line));
          root.append(paragraph);
        }
        
        if (index < lines.length - 1) {
          const paragraph = $createParagraphNode();
          root.append(paragraph);
        }
      });
    });

    hasInitialized.current = true;
  }, [editor, initialContent]);

  return null;
}

// Toolbar component for formatting
function EditorToolbar() {
  const [editor] = useLexicalComposerContext();

  const formatText = useCallback((command: string) => {
    editor.dispatchCommand(command as any, undefined);
  }, [editor]);

  return (
    <div className="lexical-toolbar border-b border-border p-2 flex items-center gap-2">
      <button 
        type="button"
        className="lexical-toolbar-item px-2 py-1 text-sm rounded hover:bg-accent"
        onClick={() => formatText('FORMAT_TEXT_COMMAND')}
        title="Fett"
      >
        <strong>B</strong>
      </button>
      <button 
        type="button"
        className="lexical-toolbar-item px-2 py-1 text-sm rounded hover:bg-accent"
        onClick={() => formatText('FORMAT_TEXT_COMMAND')}
        title="Kursiv"
      >
        <em>I</em>
      </button>
      <div className="lexical-toolbar-divider w-px h-6 bg-border mx-1" />
      <button 
        type="button"
        className="lexical-toolbar-item px-2 py-1 text-sm rounded hover:bg-accent"
        onClick={() => formatText('INSERT_UNORDERED_LIST_COMMAND')}
        title="Liste"
      >
        •
      </button>
      <button 
        type="button"
        className="lexical-toolbar-item px-2 py-1 text-sm rounded hover:bg-accent"
        onClick={() => formatText('INSERT_ORDERED_LIST_COMMAND')}
        title="Nummerierte Liste"
      >
        1.
      </button>
    </div>
  );
}

export function LexicalYjsEditor({
  documentId,
  initialContent,
  onContentChange,
  className,
  placeholder = "Beginnen Sie zu tippen...",
  readOnly = false,
  autoFocus = false
}: LexicalYjsEditorProps) {
  const yjsDocRef = useRef<Doc | null>(null);

  // Initialize Yjs document
  const initializeYjs = useCallback(() => {
    if (yjsDocRef.current) return yjsDocRef.current;

    const yjsDoc = new Doc({ guid: documentId });
    yjsDocRef.current = yjsDoc;

    return yjsDoc;
  }, [documentId]);

  // Initialize on mount
  useEffect(() => {
    initializeYjs();
  }, [initializeYjs]);

  // Editor configuration
  const initialConfig = {
    namespace: `KnowledgeEditor-${documentId}`,
    nodes: editorNodes,
    editorState: null,
    theme: {
      root: 'lexical-editor',
      paragraph: 'lexical-paragraph',
      heading: {
        h1: 'lexical-heading-h1 text-3xl font-bold mb-4',
        h2: 'lexical-heading-h2 text-2xl font-semibold mb-3',
        h3: 'lexical-heading-h3 text-xl font-medium mb-2',
      },
      list: {
        nested: {
          listitem: 'lexical-nested-listitem',
        },
        ol: 'lexical-list-ol list-decimal ml-6',
        ul: 'lexical-list-ul list-disc ml-6',
        listitem: 'lexical-listitem',
      },
      link: 'lexical-link text-primary hover:underline cursor-pointer',
      text: {
        bold: 'lexical-text-bold font-bold',
        italic: 'lexical-text-italic italic',
        underline: 'lexical-text-underline underline',
        strikethrough: 'lexical-text-strikethrough line-through',
      },
    },
    onError: (error: Error) => {
      console.error('Lexical Editor Error:', error);
    },
    editable: !readOnly,
  };

  return (
    <div className={cn("lexical-editor-container border border-input rounded-md", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="lexical-editor-inner">
          {/* Toolbar */}
          {!readOnly && <EditorToolbar />}
          
          {/* Main Editor */}
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable 
                  className={cn(
                    "lexical-content-editable",
                    "min-h-[400px] outline-none p-4 prose prose-sm max-w-none",
                    "focus-within:bg-accent/5",
                    readOnly && "cursor-default"
                  )}
                  style={{
                    resize: 'none',
                  }}
                />
              }
              placeholder={
                <div className="lexical-placeholder absolute top-4 left-4 text-muted-foreground pointer-events-none">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            
            {/* Core Plugins */}
            <HistoryPlugin />
            <LinkPlugin />
            <ListPlugin />
            <TabIndentationPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            
            {/* Auto Focus Plugin */}
            {autoFocus && <AutoFocusPlugin />}
            
            {/* Custom Content Change Plugin */}
            <ContentChangePlugin onContentChange={onContentChange} />
            
            {/* Initial Content Plugin */}
            {initialContent && (
              <InitialContentPlugin initialContent={initialContent} />
            )}
          </div>
        </div>
      </LexicalComposer>
      
      {/* Custom Styles */}
      <style>{`
        .lexical-editor {
          position: relative;
        }
        
        .lexical-paragraph {
          margin: 0 0 1em 0;
        }
        
        .lexical-paragraph:last-child {
          margin-bottom: 0;
        }
        
        .lexical-heading-h1,
        .lexical-heading-h2,
        .lexical-heading-h3 {
          margin: 1.5em 0 0.5em 0;
        }
        
        .lexical-heading-h1:first-child,
        .lexical-heading-h2:first-child,
        .lexical-heading-h3:first-child {
          margin-top: 0;
        }
        
        .lexical-list-ol,
        .lexical-list-ul {
          margin: 0 0 1em 0;
        }
        
        .lexical-listitem {
          margin: 0.25em 0;
        }
        
        .lexical-nested-listitem {
          list-style: none;
        }
        
        .lexical-link {
          cursor: pointer;
        }
        
        .lexical-toolbar-item {
          transition: background-color 0.2s;
        }
        
        .lexical-toolbar-item:hover {
          background-color: hsl(var(--accent));
        }
      `}</style>
    </div>
  );
}

export default LexicalYjsEditor;