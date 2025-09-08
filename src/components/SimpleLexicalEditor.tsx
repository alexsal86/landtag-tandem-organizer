import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { $getRoot, EditorState, $createParagraphNode, $createTextNode } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { CheckCircle, Clock } from 'lucide-react';

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

// Component to set initial content and handle updates
function ContentPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  const previousContent = useRef<string>('');

  useEffect(() => {
    // Only update if content has actually changed
    if (content && content !== previousContent.current) {
      previousContent.current = content;
      
      try {
        const editorState = editor.parseEditorState(content);
        editor.setEditorState(editorState);
      } catch (error) {
        console.error('Failed to parse editor content:', error);
        // If parsing fails, treat as plain text and create proper Lexical structure
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          
          if (content.trim()) {
            // Try to extract plain text from malformed JSON or use as-is
            let plainText = content;
            try {
              const parsed = JSON.parse(content);
              if (parsed && typeof parsed === 'string') {
                plainText = parsed;
              }
            } catch {
              // Use content as-is
            }
            
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(plainText));
            root.append(paragraph);
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
  isSaving?: boolean;
  lastSaved?: Date | null;
}

export default function SimpleLexicalEditor({ 
  initialContent = '', 
  onChange,
  className = '',
  isSaving = false,
  lastSaved = null
}: SimpleLexicalEditorProps) {
  
  // Memoize the initial config to prevent re-initialization
  const initialConfig = useMemo(() => ({
    namespace: 'KnowledgeBaseEditor',
    theme,
    onError: (error: Error) => {
      console.error('Lexical Editor Error:', error);
    }
  }), []);

  // Use useCallback to prevent unnecessary re-renders
  const handleEditorChange = useCallback((editorState: EditorState) => {
    if (onChange) {
      onChange(editorState);
    }
  }, [onChange]);

  return (
    <div className={`w-full ${className}`}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative min-h-[400px] border rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          {/* Save Status Indicator */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-2 py-1 bg-background border rounded-md shadow-sm">
            {isSaving ? (
              <>
                <Clock className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Speichern...</span>
              </>
            ) : lastSaved ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {lastSaved.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            ) : null}
          </div>
          
          <div className="p-4">
            <PlainTextPlugin
              contentEditable={<ContentEditable className="outline-none min-h-[350px] text-foreground resize-none" />}
              placeholder={<Placeholder />}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          
          <HistoryPlugin />
          <OnChangePlugin onChange={handleEditorChange} />
          <ContentPlugin content={initialContent} />
        </div>
      </LexicalComposer>
    </div>
  );
}