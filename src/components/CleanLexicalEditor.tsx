import React, { useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $generateHtmlFromNodes } from '@lexical/html';
import { $getRoot } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';

import { editorTheme } from './editor/config/editorTheme';

const editorConfig = {
  namespace: 'CleanLexicalEditor',
  nodes: [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode,
    AutoLinkNode,
    CodeNode,
    CodeHighlightNode,
  ],
  onError(error: Error) {
    throw error;
  },
  theme: editorTheme,
};

interface CleanLexicalEditorProps {
  documentId: string;
  initialContent?: string;
  onContentChange?: (content: string, html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

// Content change plugin component
function ContentChangePlugin({ onContentChange }: { onContentChange?: (content: string, html: string) => void }) {
  const [editor] = useLexicalComposerContext();
  
  const handleChange = useCallback((editorState: any) => {
    if (onContentChange) {
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        try {
          const htmlContent = $generateHtmlFromNodes(editor, null);
          onContentChange(textContent, htmlContent);
        } catch (error) {
          console.error('Error generating HTML:', error);
          onContentChange(textContent, '');
        }
      });
    }
  }, [editor, onContentChange]);

  return <OnChangePlugin onChange={handleChange} />;
}

export function CleanLexicalEditor({
  documentId,
  initialContent,
  onContentChange,
  placeholder = 'Beginne zu schreiben...',
  readOnly = false,
  autoFocus = false,
}: CleanLexicalEditorProps) {
  
  return (
    <div className="h-full flex flex-col bg-background">
      <LexicalComposer initialConfig={editorConfig}>
        <div className="flex-1 relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="min-h-96 outline-none py-4 px-6 resize-none overflow-hidden text-sm leading-6"
                aria-placeholder={placeholder}
                placeholder={
                  <div className="absolute top-4 left-6 text-muted-foreground pointer-events-none">
                    {placeholder}
                  </div>
                }
                readOnly={readOnly}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          
          <ContentChangePlugin onContentChange={onContentChange} />
          <HistoryPlugin />
          {autoFocus && <AutoFocusPlugin />}
          <LinkPlugin />
          <ListPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        </div>
      </LexicalComposer>
    </div>
  );
}