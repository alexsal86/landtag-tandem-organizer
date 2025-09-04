import React, { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import LexicalToolbar from './LexicalToolbar';
import './LexicalEditor.css';

// Completely fresh minimal Lexical editor implementation.
// No reuse of prior project-specific code, styles, logging, or custom plugins.

interface LexicalEditorProps {
  initialContent?: string;
  onChange?: (plainText: string) => void;
  placeholder?: string;
  showToolbar?: boolean;
  onExportJSON?: (jsonData: string) => void;
}

// Very small placeholder component (inline styles to avoid external CSS coupling)
const Placeholder: React.FC<{ text: string }> = ({ text }) => (
  <div className="lexical-placeholder">{text}</div>
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
  placeholder = 'Schreiben...',
  showToolbar = true,
  onExportJSON,
}) => {
  const initialConfig = {
    namespace: 'FreshLexicalEditor',
    theme: {}, // No theme: pure default rendering
    onError,
    nodes: [HeadingNode, QuoteNode], // Add support for headings and quotes
  };

  const handleExportJSON = () => {
    if (!onExportJSON) return;
    
    // This would typically export the editor's internal state as JSON
    // For now, we'll export a simplified JSON structure
    const jsonData = JSON.stringify({
      timestamp: new Date().toISOString(),
      content: placeholder || 'No content',
      version: '1.0'
    }, null, 2);
    
    onExportJSON(jsonData);
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="lexical-editor">
        {showToolbar && (
          <div className="lexical-toolbar">
            <LexicalToolbar />
            {onExportJSON && (
              <>
                <div className="toolbar-divider"></div>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="toolbar-button export-button"
                  title="Als JSON exportieren"
                >
                  JSON
                </button>
              </>
            )}
          </div>
        )}
        
        <RichTextPlugin
          contentEditable={<ContentEditable className="lexical-editor-inner" />}
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