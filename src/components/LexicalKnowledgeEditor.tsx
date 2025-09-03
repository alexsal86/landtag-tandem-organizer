import React, { useCallback } from 'react';
import { LexicalYjsEditor } from './LexicalYjsEditor';
import { useYjsKnowledgeDocument } from '@/hooks/useYjsKnowledgeDocument';
import { useToast } from '@/hooks/use-toast';

interface LexicalKnowledgeEditorProps {
  documentId: string;
  onClose: () => void;
}

export function LexicalKnowledgeEditor({ documentId, onClose }: LexicalKnowledgeEditorProps) {
  const { toast } = useToast();
  
  console.log('LexicalKnowledgeEditor: Starting with documentId:', documentId);
  
  // Stable error handler
  const handleError = useCallback((error: Error) => {
    console.error('LexicalKnowledgeEditor: Error from useYjsKnowledgeDocument:', error);
    toast({
      title: "Fehler",
      description: "Ein Fehler ist beim Laden des Dokuments aufgetreten.",
      variant: "destructive"
    });
  }, [toast]);
  
  const {
    isLoading,
    initialContent,
    saveDocument
  } = useYjsKnowledgeDocument({
    documentId,
    onError: handleError
  });

  console.log('LexicalKnowledgeEditor: Hook state:', { isLoading, initialContentLength: initialContent?.length || 0 });

  console.log('LexicalKnowledgeEditor: Render check - isLoading:', isLoading);

  if (isLoading) {
    console.log('LexicalKnowledgeEditor: Showing loading state');
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Dokument wird geladen...</p>
        </div>
      </div>
    );
  }

  console.log('LexicalKnowledgeEditor: Rendering editor with content length:', initialContent?.length || 0);

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
        <LexicalYjsEditor
          documentId={documentId}
          initialContent={initialContent}
          onContentChange={saveDocument}
          className="h-full border-0"
          autoFocus
        />
      </div>
    </div>
  );
}