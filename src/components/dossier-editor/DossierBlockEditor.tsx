import '@/styles/lexical-editor.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from '@lexical/react/LexicalAutoLinkPlugin';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, EditorState, LexicalEditor } from 'lexical';
import { ListNode, ListItemNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HashtagNode } from '@lexical/hashtag';
import { MarkNode } from '@lexical/mark';
import { TRANSFORMERS } from '@lexical/markdown';

import { ImageNode } from '@/components/nodes/ImageNode';
import { MentionNode } from '@/components/nodes/MentionNode';

import { EnhancedLexicalToolbar } from '@/components/lexical/EnhancedLexicalToolbar';
import ComponentPickerPlugin from '@/components/plugins/ComponentPickerPlugin';
import DraggableBlockPlugin from '@/components/plugins/DraggableBlockPlugin';

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

interface DossierBlockEditorProps {
  initialContent?: string;
  contentVersion?: string | number;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const hashContent = (content: string): string => {
  let hash = 5381;
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return `h${hash >>> 0}`;
};

function InitialContentPlugin({
  initialContent,
  contentVersion,
}: {
  initialContent?: string;
  contentVersion?: string | number;
}) {
  const [editor] = useLexicalComposerContext();
  const draftInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    const rehydrateKey = contentVersion != null
      ? String(contentVersion)
      : hashContent(initialContent ?? '');

    if (draftInitializedRef.current === rehydrateKey) return;
    draftInitializedRef.current = rehydrateKey;

    if (!initialContent?.trim()) return;

    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const parser = new DOMParser();
      const dom = parser.parseFromString(initialContent, 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);
      root.append(...nodes);
    });
  }, [editor, initialContent, contentVersion]);

  return null;
}

const editorTheme = {
  paragraph: 'editor-paragraph',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-muted px-1.5 py-0.5 rounded text-sm font-mono',
    subscript: 'text-[0.8em] align-sub',
    superscript: 'text-[0.8em] align-super',
  },
  list: {
    nested: { listitem: 'list-none' },
    ol: 'list-decimal ml-6 mb-4 space-y-1',
    ul: 'list-disc ml-6 mb-4 space-y-1',
    listitem: 'mb-1',
    listitemChecked: 'line-through opacity-60',
    listitemUnchecked: '',
  },
  heading: {
    h1: 'text-3xl font-bold mb-4 mt-6 first:mt-0',
    h2: 'text-2xl font-bold mb-3 mt-5 first:mt-0',
    h3: 'text-xl font-bold mb-2 mt-4 first:mt-0',
  },
  quote: 'border-l-4 border-muted-foreground pl-4 py-2 my-4 italic text-muted-foreground bg-muted/30 rounded-r',
  code: 'bg-muted p-4 rounded my-4 overflow-x-auto font-mono text-sm',
  link: 'text-primary underline hover:text-primary/80 transition-colors',
  table: 'border-collapse border border-border w-full my-2',
  tableCell: 'border border-border p-2 min-w-[60px] relative',
  tableCellHeader: 'border border-border p-2 font-bold bg-muted/50',
  tableRow: 'border-b border-border',
  hashtag: 'text-primary font-medium',
  image: 'inline-block max-w-full',
  horizontalRule: 'my-4 border-t-2 border-border',
  mark: 'bg-yellow-200 dark:bg-yellow-800',
};

const editorNodes = [
  HeadingNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  ListNode,
  ListItemNode,
  HorizontalRuleNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  HashtagNode,
  MarkNode,
  ImageNode,
  MentionNode,
];

export default function DossierBlockEditor({
  initialContent,
  contentVersion,
  onChange,
  placeholder = "Schreibe '/' für Befehle …",
  minHeight = '300px',
}: DossierBlockEditorProps) {
  const [editorContainerRef, setEditorContainerRef] = useState<HTMLDivElement | null>(null);

  const handleChange = useCallback(
    (_editorState: EditorState, editor: LexicalEditor) => {
      editor.read(() => {
        const root = $getRoot();
        if (root.getTextContent().trim() === '' && root.getChildrenSize() <= 1) {
          onChange('');
          return;
        }
        const html = $generateHtmlFromNodes(editor);
        onChange(html);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const initialConfig = {
    namespace: 'DossierBlockEditor',
    theme: editorTheme,
    nodes: editorNodes,
    onError: (error: Error) => console.error('[DossierBlockEditor]', error),
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="dossier-block-editor">
        {/* Persistent Toolbar */}
        <EnhancedLexicalToolbar />

        <div
          ref={setEditorContainerRef}
          className="dossier-block-editor-content"
          style={{ position: 'relative' }}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="dossier-block-editor-input"
                style={{ minHeight }}
              />
            }
            placeholder={
              <div className="dossier-block-editor-placeholder">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <TablePlugin />
          <AutoLinkPlugin matchers={MATCHERS} />
          <TabIndentationPlugin />
          <HorizontalRulePlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
          <InitialContentPlugin
            initialContent={initialContent}
            contentVersion={contentVersion}
          />
          <ComponentPickerPlugin />
          {editorContainerRef && (
            <DraggableBlockPlugin anchorElem={editorContainerRef} />
          )}
        </div>
      </div>
    </LexicalComposer>
  );
}
