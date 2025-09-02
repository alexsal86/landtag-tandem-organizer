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
  
  console.log('LexicalKnowledgeEditor: Starting with documentId:', documentId);
  
  const {
    isLoading,
    initialContent,
    saveDocument
  } = useYjsKnowledgeDocument({
    documentId,
    onError: (error) => {
      console.error('LexicalKnowledgeEditor: Error from useYjsKnowledgeDocument:', error);
      toast({
        title: "Fehler",
        description: "Ein Fehler ist beim Laden des Dokuments aufgetreten.",
        variant: "destructive"
      });
    }
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
      <div className="flex-1 overflow-hidden p-4">
        <div className="border rounded-lg p-4 h-full bg-card">
          <h3 className="font-semibold mb-2">Test Editor (Dokumentinhalt geladen)</h3>
          <div className="text-sm text-muted-foreground mb-4">
            Dokument ID: {documentId}
          </div>
          <div className="text-sm mb-4">
            Inhalt ({initialContent?.length || 0} Zeichen):
          </div>
          <textarea 
            className="w-full h-64 p-2 border rounded resize-none"
            defaultValue={initialContent}
            placeholder="Beginnen Sie zu tippen..."
          />
          <div className="mt-4 text-xs text-muted-foreground">
            ✅ Dokument erfolgreich geladen - LexicalYjsEditor temporär deaktiviert für Tests
          </div>
        </div>
      </div>
    </div>
  );
}