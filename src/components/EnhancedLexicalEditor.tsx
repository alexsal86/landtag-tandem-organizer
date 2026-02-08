import React, { useCallback, useMemo, useRef } from 'react';
import { $getRoot, EditorState, $createParagraphNode, $createTextNode } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from '@lexical/react/LexicalAutoLinkPlugin';
import { useEffect } from 'react';

// Lexical nodes
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HashtagNode } from '@lexical/hashtag';
import { MarkNode } from '@lexical/mark';
import { TRANSFORMERS } from '@lexical/markdown';

// Custom nodes
import { ImageNode } from './nodes/ImageNode';

// UI
import FloatingTextFormatToolbar from './FloatingTextFormatToolbar';
import { EnhancedLexicalToolbar } from './EnhancedLexicalToolbar';

// Plugins
import { ImagePlugin } from './plugins/ImagePlugin';
import { CommentPlugin, CommentMarkNode } from './plugins/CommentPlugin';
import { VersionHistoryPlugin } from './plugins/VersionHistoryPlugin';
import { MentionsPlugin } from './plugins/MentionsPlugin';

// AutoLink matchers
const URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

const MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) =>
    text.startsWith('http') ? text : `https://${text}`,
  ),
  createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => `mailto:${text}`),
];

interface EnhancedLexicalEditorProps {
  content: string;
  contentNodes?: string;
  onChange: (content: string, contentNodes?: string) => void;
  placeholder?: string;
  documentId?: string;
  showToolbar?: boolean;
  editable?: boolean;
  // Legacy props - kept for API compatibility
  enableCollaboration?: boolean;
  useYjsCollaboration?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  showCollabDashboard?: boolean;
  onCollabDashboardToggle?: () => void;
}

// Content Plugin - loads initial content ONCE on mount
function ContentPlugin({ content, contentNodes }: { content: string; contentNodes?: string }) {
  const [editor] = useLexicalComposerContext();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!editor || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    if (contentNodes && contentNodes.trim()) {
      try {
        const editorState = editor.parseEditorState(contentNodes);
        editor.setEditorState(editorState);
        return;
      } catch (error) {
        console.warn('[ContentPlugin] Failed to parse contentNodes:', error);
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
  }, [editor]);

  return null;
}

const editorTheme = {
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-muted px-1.5 py-0.5 rounded text-sm font-mono',
    subscript: 'text-[0.8em] align-sub',
    superscript: 'text-[0.8em] align-super',
  },
  heading: {
    h1: 'text-2xl font-bold mt-4 mb-2',
    h2: 'text-xl font-bold mt-3 mb-2',
    h3: 'text-lg font-bold mt-3 mb-1',
  },
  quote: 'border-l-4 border-primary pl-4 italic my-2 text-muted-foreground',
  code: 'bg-muted p-3 rounded font-mono text-sm block my-2 overflow-x-auto',
  list: {
    ul: 'list-disc list-outside ml-6',
    ol: 'list-decimal list-outside ml-6',
    listitem: 'mb-1',
    listitemChecked:
      'list-none relative pl-6 line-through text-muted-foreground before:absolute before:left-0 before:content-["✓"] before:text-primary',
    listitemUnchecked:
      'list-none relative pl-6 before:absolute before:left-0 before:content-["☐"]',
    nested: {
      listitem: 'list-none',
    },
  },
  link: 'text-primary underline cursor-pointer hover:text-primary/80',
  table: 'border-collapse border border-border w-full my-2',
  tableCell: 'border border-border p-2 min-w-[60px] relative',
  tableCellHeader: 'border border-border p-2 font-bold bg-muted/50',
  tableRow: 'border-b border-border',
  hashtag: 'text-primary font-medium',
  image: 'inline-block max-w-full',
  horizontalRule: 'my-4 border-t-2 border-border',
  paragraph: 'mb-1',
  mark: 'bg-yellow-200 dark:bg-yellow-800',
};

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
    theme: editorTheme,
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
      HorizontalRuleNode,
      HashtagNode,
      MarkNode,
      ImageNode,
      CommentMarkNode,
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
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

          {/* Official Lexical Plugins */}
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <HorizontalRulePlugin />
          <ClickableLinkPlugin newTab />
          <AutoLinkPlugin matchers={MATCHERS} />
          <TablePlugin hasCellMerge hasCellBackgroundColor hasTabHandler />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <TabIndentationPlugin />

          {/* Custom Plugins */}
          <ImagePlugin />
          <MentionsPlugin />
          <CommentPlugin documentId={documentId} />
          <VersionHistoryPlugin documentId={documentId} />
        </div>
      </LexicalComposer>
    </div>
  );
}
