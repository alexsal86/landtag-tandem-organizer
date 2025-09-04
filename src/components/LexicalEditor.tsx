import React, { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';

// Completely fresh minimal Lexical editor implementation.
// No reuse of prior project-specific code, styles, logging, or custom plugins.

interface LexicalEditorProps {
  initialContent?: string;
  onChange?: (plainText: string) => void;
  placeholder?: string;
}

// Very small placeholder component (inline styles to avoid external CSS coupling)
const Placeholder: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    opacity: 0.4,
    fontStyle: 'italic',
    padding: '4px 6px'
  }}>{text}</div>
);

// Plugin to set initial content exactly once after mount (if editor is empty)
const InitialContentPlugin: React.FC<{ initialContent?: string }> = ({ initialContent }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!initialContent) return;
    editor.update(() => {
      const root = $getRoot();
      if (root.getFirstChild() === null) {
        const p = $createParagraphNode();
        p.append($createTextNode(initialContent));
        root.append(p);
      }
    });
  }, [editor, initialContent]);
  return null;
};

function onError(error: Error) {
  // Let the error surface; minimal logging only.
  console.error(error); // eslint-disable-line no-console
}

const LexicalEditor: React.FC<LexicalEditorProps> = ({
  initialContent,
  onChange,
  placeholder = 'Schreiben...' ,
}) => {
  const initialConfig = {
    namespace: 'FreshLexicalEditor',
    theme: {}, // No theme: pure default rendering
    onError,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div style={{ position: 'relative', border: '1px solid #ccc', borderRadius: 4, padding: 4, minHeight: 120 }}>
        <RichTextPlugin
          contentEditable={<ContentEditable style={{ outline: 'none', minHeight: 112, padding: '4px 6px' }} />}
          placeholder={<Placeholder text={placeholder} />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <InitialContentPlugin initialContent={initialContent} />
        {onChange && (
          <OnChangePlugin
            onChange={(editorState) => {
              if (!onChange) return;
              editorState.read(() => {
                const text = $getRoot().getTextContent();
                onChange(text);
              });
            }}
          />
        )}
      </div>
    </LexicalComposer>
  );
};

export default LexicalEditor;