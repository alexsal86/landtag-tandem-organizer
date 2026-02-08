import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { $getRoot, EditorState, $createParagraphNode, $createTextNode } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

interface SimpleLexicalEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  // Legacy props - kept for API compatibility, no-op now
  documentId?: string;
  enableCollaboration?: boolean;
  useYjsCollaboration?: boolean;
}

// Content Plugin - loads initial content ONCE on mount
function ContentPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!editor || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    if (content && content.trim()) {
      editor.update(() => {
        const root = $getRoot();
        if (root.isEmpty()) {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(content));
          root.append(paragraph);
        }
      });
    }
  }, [editor]);

  return null;
}

export default function SimpleLexicalEditor({
  content,
  onChange,
  placeholder = "Beginnen Sie zu schreiben...",
}: SimpleLexicalEditorProps) {
  const initialConfig = useMemo(() => ({
    namespace: 'SimpleEditor',
    theme: {
      paragraph: 'editor-paragraph',
      text: {
        bold: 'editor-text-bold',
        italic: 'editor-text-italic',
        underline: 'editor-text-underline',
      },
    },
    onError: (error: Error) => {
      console.error('Lexical Error:', error);
    },
    nodes: []
  }), []);

  const handleChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      onChange(root.getTextContent());
    });
  }, [onChange]);

  return (
    <div className="border rounded-lg">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="editor-inner relative">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable
                className="editor-input min-h-[300px] p-4 focus:outline-none resize-none"
              />
            }
            placeholder={
              <div className="editor-placeholder absolute top-4 left-4 text-muted-foreground pointer-events-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <OnChangePlugin onChange={handleChange} />
          <HistoryPlugin />
          <ContentPlugin content={content} />
        </div>
      </LexicalComposer>
    </div>
  );
}
