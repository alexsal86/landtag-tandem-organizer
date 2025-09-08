import React, { useCallback } from 'react';
import { $getRoot, $getSelection, EditorState } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createParagraphNode, $createTextNode } from 'lexical';

interface SimpleLexicalEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

// Content Plugin to sync content
function ContentPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  
  React.useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      if (root.isEmpty() && content) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(content));
        root.append(paragraph);
      }
    });
  }, [editor, content]);

  return null;
}

export default function SimpleLexicalEditor({ 
  content, 
  onChange, 
  placeholder = "Beginnen Sie zu schreiben..." 
}: SimpleLexicalEditorProps) {
  const initialConfig = {
    namespace: 'KnowledgeEditor',
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
  };

  const handleOnChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      onChange(textContent);
    });
  }, [onChange]);

  return (
    <div className="editor-container">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="editor-inner">
          <PlainTextPlugin
            contentEditable={
              <ContentEditable 
                className="editor-input min-h-[300px] p-4 focus:outline-none" 
                style={{ resize: 'none' }}
              />
            }
            placeholder={
              <div className="editor-placeholder absolute top-4 left-4 text-muted-foreground pointer-events-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <OnChangePlugin onChange={handleOnChange} />
          <HistoryPlugin />
          <ContentPlugin content={content} />
        </div>
      </LexicalComposer>
    </div>
  );
}