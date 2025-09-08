import React, { useEffect } from 'react';
import { $getRoot, $getSelection, EditorState } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

const theme = {
  // Theme styling goes here
  paragraph: 'mb-1',
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
  },
};

function Placeholder() {
  return <div className="text-muted-foreground">Beginnen Sie zu schreiben...</div>;
}

// Component to set initial content
function InitialContentPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (content) {
      try {
        const editorState = editor.parseEditorState(content);
        editor.setEditorState(editorState);
      } catch (error) {
        // If parsing fails, try to set as plain text
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = root.getFirstChild();
          if (paragraph) {
            paragraph.selectEnd();
          }
        });
      }
    }
  }, [editor, content]);

  return null;
}

interface SimpleLexicalEditorProps {
  initialContent?: string;
  onChange?: (editorState: EditorState) => void;
  className?: string;
}

export default function SimpleLexicalEditor({ 
  initialContent = '', 
  onChange,
  className = ''
}: SimpleLexicalEditorProps) {
  
  const initialConfig = {
    namespace: 'KnowledgeBaseEditor',
    theme,
    onError: (error: Error) => {
      console.error('Lexical Editor Error:', error);
    }
  };

  const handleEditorChange = (editorState: EditorState) => {
    if (onChange) {
      onChange(editorState);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative min-h-[400px] border rounded-lg p-4 bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <PlainTextPlugin
            contentEditable={<ContentEditable className="outline-none min-h-[350px] text-foreground" />}
            placeholder={<Placeholder />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <OnChangePlugin onChange={handleEditorChange} />
          <InitialContentPlugin content={initialContent} />
        </div>
      </LexicalComposer>
    </div>
  );
}