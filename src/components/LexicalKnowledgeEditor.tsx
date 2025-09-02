import React from 'react';
import LexicalYjsEditor from './LexicalYjsEditor';
import { useYjsKnowledgeDocument } from '@/hooks/useYjsKnowledgeDocument';
import { useToast } from '@/hooks/use-toast';

interface LexicalKnowledgeEditorProps {
  documentId: string;
  onClose: () => void;
}

export function LexicalKnowledgeEditor({ documentId, onClose }: LexicalKnowledgeEditorProps) {
  const { toast } = useToast();
  
  const {
    isLoading,
    initialContent,
    saveDocument
  } = useYjsKnowledgeDocument({
    documentId,
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist beim Laden des Dokuments aufgetreten.",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <LexicalYjsEditor
      documentId={documentId}
      initialContent={initialContent}
      onContentChange={saveDocument}
      className="h-full"
      autoFocus
    />
  );
}