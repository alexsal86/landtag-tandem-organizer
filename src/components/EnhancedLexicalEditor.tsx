import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { $getRoot, $getSelection, EditorState, $isRangeSelection } from 'lexical';
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
import { $generateHtmlFromNodes } from '@lexical/html';
import { FORMAT_TEXT_COMMAND, TextFormatType, $createParagraphNode, $createTextNode } from 'lexical';

// Lexical nodes
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HashtagNode } from '@lexical/hashtag';
import { MarkNode } from '@lexical/mark';
import { TRANSFORMERS } from '@lexical/markdown';

import FloatingTextFormatToolbar from './FloatingTextFormatToolbar';
import { EnhancedLexicalToolbar } from './EnhancedLexicalToolbar';

// Plugins
import { EnhancedTablePlugin } from './plugins/EnhancedTablePlugin';
import { FixedTablePlugin } from './plugins/FixedTablePlugin';
import { EnhancedLinkPlugin } from './plugins/EnhancedLinkPlugin';
import { DraggableBlocksPlugin } from './plugins/DraggableBlocksPlugin';
import { MentionsPlugin } from './plugins/MentionsPlugin';
import { ImagePlugin } from './plugins/ImagePlugin';
import { FileAttachmentPlugin } from './plugins/FileAttachmentPlugin';
import { CommentPlugin, CommentMarkNode } from './plugins/CommentPlugin';
import { VersionHistoryPlugin } from './plugins/VersionHistoryPlugin';

interface EnhancedLexicalEditorProps {
  content: string;
  contentNodes?: string;
  onChange: (content: string, contentNodes?: string) => void;
  placeholder?: string;
  documentId?: string;
  showToolbar?: boolean;
  editable?: boolean;
  // Legacy props - kept for API compatibility, no-op now
  enableCollaboration?: boolean;
  useYjsCollaboration?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  showCollabDashboard?: boolean;
  onCollabDashboardToggle?: () => void;
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

// Content Plugin - loads initial content ONCE on mount
function ContentPlugin({ content, contentNodes }: { content: string; contentNodes?: string }) {
  const [editor] = useLexicalComposerContext();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!editor || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Priority: JSON contentNodes > plain text content
    if (contentNodes && contentNodes.trim()) {
      try {
        const editorState = editor.parseEditorState(contentNodes);
        editor.setEditorState(editorState);
        return;
      } catch (error) {
        console.warn('[ContentPlugin] Failed to parse contentNodes, falling back to plain text:', error);
      }
    }

    if (content && content.trim()) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(content));
        root.append(paragraph);
      });
    }
  }, [editor]); // Only run once on mount

  return null;
}

export default function EnhancedLexicalEditor({
  content,
  contentNodes,
  onChange,
  placeholder = "Beginnen Sie zu schreiben...",
  documentId,
  showToolbar = true,
  editable = true,
}: EnhancedLexicalEditorProps) {
  const initialConfig = useMemo(() => ({
    namespace: 'EnhancedEditor',
    editable,
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
        ol: 'list-decimal list-outside ml-4',
        listitem: 'mb-1',
        listitemChecked: 'list-none line-through text-muted-foreground',
        listitemUnchecked: 'list-none',
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
      CommentMarkNode,
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    }
  }), [editable]);

  const handleChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const plainText = root.getTextContent();
      let jsonContent: string | undefined;
      try {
        jsonContent = JSON.stringify(editorState.toJSON());
      } catch {
        jsonContent = undefined;
      }
      onChange(plainText, jsonContent);
    });
  }, [onChange]);

  return (
    <div className="relative min-h-[200px] border rounded-md overflow-hidden">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="editor-inner relative">
          {showToolbar && <EnhancedLexicalToolbar documentId={documentId} />}

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

          <OnChangePlugin onChange={handleChange} />
          <ContentPlugin content={content} contentNodes={contentNodes} />

          {/* Core Plugins */}
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <KeyboardShortcutsPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <TabIndentationPlugin />

          {/* Enhanced Plugins */}
          <FixedTablePlugin />
          <EnhancedTablePlugin />
          <EnhancedLinkPlugin />
          <DraggableBlocksPlugin />
          <MentionsPlugin />
          <ImagePlugin />
          <FileAttachmentPlugin />
          <CommentPlugin documentId={documentId} />
          <VersionHistoryPlugin documentId={documentId} />
        </div>
      </LexicalComposer>
    </div>
  );
}
