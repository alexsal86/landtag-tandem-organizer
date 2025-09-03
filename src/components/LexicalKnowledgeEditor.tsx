import React from 'react';
import { CleanLexicalEditor } from './CleanLexicalEditor';

interface LexicalKnowledgeEditorProps {
  documentId: string;
  onClose: () => void;
}

export function LexicalKnowledgeEditor({ documentId, onClose }: LexicalKnowledgeEditorProps) {
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-4 border-b">
        <button 
          onClick={onClose}
          className="text-sm px-3 py-1 bg-secondary hover:bg-secondary/80 rounded"
        >
          ← Zurück
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <CleanLexicalEditor
          documentId={documentId}
          autoFocus
        />
      </div>
    </div>
  );
}