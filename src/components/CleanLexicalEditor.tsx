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

export function CleanLexicalEditor({
  documentId,
  initialContent,
  onContentChange,
  placeholder = 'Beginne zu schreiben...',
  readOnly = false,
  autoFocus = false,
}: CleanLexicalEditorProps) {
  
  // Content change handler
  const handleContentChange = useCallback((editorState: any) => {
    if (onContentChange) {
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        const htmlContent = $generateHtmlFromNodes(editorState._editor, null);
        onContentChange(textContent, htmlContent);
      });
    }
  }, [onContentChange]);

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
          
          <OnChangePlugin onChange={handleContentChange} />
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