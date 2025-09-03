import React from 'react';
import { CleanLexicalEditor } from './CleanLexicalEditor';

interface LexicalKnowledgeEditorProps {
  documentId?: string;
  onClose: () => void;
}

export function LexicalKnowledgeEditor({ documentId, onClose }: LexicalKnowledgeEditorProps) {
  
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-none p-3 border-b bg-muted/30">
        <button 
          onClick={onClose}
          className="text-sm px-3 py-1.5 bg-background hover:bg-accent rounded-md border transition-colors"
        >
          ← Zurück zur Übersicht
        </button>
      </div>
      <div className="flex-1 p-4">
        <CleanLexicalEditor
          documentId={documentId}
          autoFocus
        />
      </div>
    </div>
  );
}