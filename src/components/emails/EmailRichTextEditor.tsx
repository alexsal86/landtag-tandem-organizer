import React from 'react';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { $generateHtmlFromNodes } from '@lexical/html';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { CodeNode } from '@lexical/code';
import { EnhancedLexicalToolbar } from '@/components/EnhancedLexicalToolbar';

interface EmailRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const EmailRichTextEditor: React.FC<EmailRichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "E-Mail-Text eingeben...",
  disabled = false
}) => {
  const initialConfig = {
    namespace: 'EmailEditor',
    editable: !disabled,
    theme: {
      paragraph: 'mb-2',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
      },
      link: 'text-primary underline cursor-pointer',
      list: {
        ul: 'list-disc ml-6',
        ol: 'list-decimal ml-6',
      }
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      CodeNode
    ],
    onError: (error: Error) => {
      console.error('Lexical Error:', error);
    },
  };

  const handleChange = (editorState: any, editor: any) => {
    if (disabled) return;
    
    editorState.read(() => {
      const htmlString = $generateHtmlFromNodes(editor, null);
      onChange(htmlString);
    });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <LexicalComposer initialConfig={initialConfig}>
        <EnhancedLexicalToolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="min-h-[300px] p-4 focus:outline-none prose prose-sm max-w-none"
                aria-placeholder={placeholder}
                placeholder={<div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">{placeholder}</div>}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} />
        <LinkPlugin />
        <ListPlugin />
      </LexicalComposer>
    </div>
  );
};

export default EmailRichTextEditor;
