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

function Placeholder({ text }: { text?: string }) {
  return <div className="editor-placeholder">{text || "Hier schreiben..."}</div>;
}

interface LexicalEditorProps {
  value?: string;
  onChange?: (editorState: EditorState) => void;
  placeholder?: string;
  className?: string;
  documentId?: string;
  tenantId?: string;
  onSave?: (jsonContent: string) => Promise<void>;
}

export default function LexicalEditor({ 
  value, 
  onChange, 
  placeholder,
  className,
  documentId,
  tenantId,
  onSave 
}: LexicalEditorProps) {
  const [currentEditorState, setCurrentEditorState] = useState<string>('');
  const [initialEditorState, setInitialEditorState] = useState<string | null>(null);

  // Load initial state from value prop (for Supabase) or localStorage on mount
  useEffect(() => {
    try {
      // If documentId is provided, use the value prop (from Supabase)
      if (documentId && value) {
        console.log('Loading editor state from provided value for document:', documentId);
        setInitialEditorState(value);
        setCurrentEditorState(value);
      } else {
        // Fallback to localStorage for standalone mode
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
          console.log('Loading editor state from localStorage');
          setInitialEditorState(savedState);
          setCurrentEditorState(savedState);
        }
      }
    } catch (error) {
      console.warn('Failed to load editor state:', error);
    }
  }, [documentId, value]);

  // Save state and call callbacks
  const handleEditorChange = async (editorState: EditorState) => {
    try {
      const jsonState = JSON.stringify(editorState.toJSON());
      
      // Always update local state for JSON display
      setCurrentEditorState(jsonState);
      
      // Save to external system (Supabase) if callback provided
      if (onSave && documentId) {
        try {
          await onSave(jsonState);
        } catch (error) {
          console.error('Failed to save to external system:', error);
        }
      } else {
        // Fallback to localStorage for standalone mode
        localStorage.setItem(STORAGE_KEY, jsonState);
      }
      
      // Call the onChange callback if provided
      if (onChange) {
        onChange(editorState);
      }
    } catch (error) {
      console.error('Failed to handle editor change:', error);
    }
  };

  const handleClear = async () => {
    setCurrentEditorState('');
    
    // Clear from external system if callback provided
    if (onSave && documentId) {
      try {
        await onSave('');
      } catch (error) {
        console.error('Failed to clear external content:', error);
      }
    } else {
      // Clear localStorage for standalone mode
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Catch any errors that occur during Lexical updates and log them
  // or throw them as needed. If you don't throw them, Lexical will
  // try to recover gracefully without losing user data.
  function onError(error: Error) {
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
        <div className={`border rounded p-3 bg-white ${className || 'min-h-[200px]'}`}>
          <RichTextPlugin
            contentEditable={<ContentEditable className="min-h-[150px] outline-none" />}
            placeholder={<Placeholder text={placeholder} />}
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
          {documentId ? (
            `State is synchronized with document ID: ${documentId}${tenantId ? ` (Tenant: ${tenantId})` : ''}`
          ) : (
            `State is automatically saved to localStorage (key: '${STORAGE_KEY}')`
          )}
        </p>
      </div>
    </div>
  );
}

