import {$getRoot, $getSelection, EditorState} from 'lexical';
import {useEffect, useState} from 'react';

import {AutoFocusPlugin} from '@lexical/react/LexicalAutoFocusPlugin';
import {LexicalComposer} from '@lexical/react/LexicalComposer';
import {RichTextPlugin} from '@lexical/react/LexicalRichTextPlugin';
import {ContentEditable} from '@lexical/react/LexicalContentEditable';
import {HistoryPlugin} from '@lexical/react/LexicalHistoryPlugin';
import {LexicalErrorBoundary} from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Button } from "@/components/ui/button";

const theme = {
  // Theme styling goes here
  //...
}

// localStorage key for persisting editor content
const STORAGE_KEY = 'lexical-editor-content';

// Component to handle editor state persistence and clear functionality
function EditorStateManager({ 
  onStateChange, 
  onClear 
}: { 
  onStateChange: (jsonState: string) => void, 
  onClear: () => void 
}) {
  const [editor] = useLexicalComposerContext();

  const handleClearContent = () => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
    });
    // Clear localStorage as well
    localStorage.removeItem(STORAGE_KEY);
    onClear();
  };

  return (
    <div className="flex justify-end mt-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleClearContent}
        className="text-xs"
      >
        Clear Content
      </Button>
    </div>
  );
}

function Placeholder() {
  return <div className="editor-placeholder">Hier schreiben...</div>;
}

export default function LexicalEditor({ value, onChange }: { value?: string, onChange?: (editorState: any) => void }) {
  const [currentEditorState, setCurrentEditorState] = useState<string>('');
  const [initialEditorState, setInitialEditorState] = useState<string | null>(null);

  // Load initial state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        console.log('Loading editor state from localStorage');
        setInitialEditorState(savedState);
        setCurrentEditorState(savedState);
      }
    } catch (error) {
      console.warn('Failed to load editor state from localStorage:', error);
    }
  }, []);

  // Save state to localStorage and call onChange callback
  const handleEditorChange = (editorState: EditorState) => {
    try {
      const jsonState = JSON.stringify(editorState.toJSON());
      
      // Save to localStorage
      // TODO: In a real application, this would also sync with backend database
      localStorage.setItem(STORAGE_KEY, jsonState);
      
      setCurrentEditorState(jsonState);
      
      // Call the onChange callback if provided
      if (onChange) {
        onChange(editorState);
      }
    } catch (error) {
      console.error('Failed to save editor state:', error);
    }
  };

  const handleClear = () => {
    setCurrentEditorState('');
  };

  // Catch any errors that occur during Lexical updates and log them
  // or throw them as needed. If you don't throw them, Lexical will
  // try to recover gracefully without losing user data.
  function onError(error: any) {
    console.error(error);
  }

  const initialConfig = {
    namespace: 'MyEditor',
    theme,
    onError,
    // Set initial editor state from localStorage if available
    editorState: initialEditorState,
  };

  return (
    <div className="space-y-4">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="border rounded p-3 min-h-[200px] bg-white">
          <RichTextPlugin
            contentEditable={<ContentEditable className="min-h-[150px] outline-none" />}
            placeholder={<Placeholder />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <OnChangePlugin onChange={handleEditorChange} />
          <EditorStateManager 
            onStateChange={setCurrentEditorState}
            onClear={handleClear}
          />
        </div>
      </LexicalComposer>
      
      {/* Debug JSON State Display */}
      <div className="border rounded p-3 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Current Editor State (JSON Debug):
        </h3>
        <pre className="text-xs text-gray-600 bg-white p-2 rounded border overflow-auto max-h-40">
          {currentEditorState ? 
            JSON.stringify(JSON.parse(currentEditorState), null, 2) : 
            'No content yet...'
          }
        </pre>
        <p className="text-xs text-gray-500 mt-1">
          {/* TODO: Backend Integration Point - This state would be synchronized with database */}
          State is automatically saved to localStorage (key: '{STORAGE_KEY}')
        </p>
      </div>
    </div>
  );
}

