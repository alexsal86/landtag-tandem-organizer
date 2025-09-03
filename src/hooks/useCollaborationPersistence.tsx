import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as Y from 'yjs';

interface UseCollaborationPersistenceProps {
  documentId?: string;
  yDoc?: Y.Doc | null;
  enableCollaboration?: boolean;
  debounceMs?: number;
}

interface DocumentSnapshot {
  id: string;
  document_id: string;
  yjs_state: ArrayBuffer;
  document_version: number;
  created_by: string;
  created_at: string;
  snapshot_type: 'auto' | 'manual';
}

export const useCollaborationPersistence = ({
  documentId,
  yDoc,
  enableCollaboration,
  debounceMs = 5000
}: UseCollaborationPersistenceProps) => {
  const { toast } = useToast();

  // Save document state to database
  const saveDocumentState = useCallback(async (doc: Y.Doc) => {
    if (!documentId || !doc) return;

    try {
      // Get the current document state as binary
      const state = Y.encodeStateAsUpdate(doc);
      
      // Convert to base64 for database storage  
      const base64State = btoa(String.fromCharCode(...state));
      
      // Use function for creating snapshots with proper RLS checking
      const { data, error } = await supabase.rpc('create_knowledge_document_snapshot', {
        _document_id: documentId,
        _yjs_state: base64State,
        _snapshot_type: 'auto'
      });

      if (error) {
        console.error('Error saving document state:', error);
        return;
      }

      console.log('Document state saved successfully');
    } catch (error) {
      console.error('Error in saveDocumentState:', error);
    }
  }, [documentId]);

  // Load document state from database
  const loadDocumentState = useCallback(async (doc: Y.Doc) => {
    if (!documentId || !doc) return;

    try {
      // Get the latest document snapshot
      const { data, error } = await supabase
        .from('knowledge_document_snapshots')
        .select('yjs_state')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading document state:', error);
        return;
      }

      if (data?.yjs_state && typeof data.yjs_state === 'string') {
        try {
          // Convert from base64 back to Uint8Array
          const binaryString = atob(data.yjs_state);
          const state = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            state[i] = binaryString.charCodeAt(i);
          }
          
          Y.applyUpdate(doc, state);
          console.log('Document state loaded successfully');
        } catch (yError) {
          console.error('Error applying Y.js update:', yError);
          // Skip malformed state data
        }
      }
    } catch (error) {
      console.error('Error in loadDocumentState:', error);
    }
  }, [documentId]);

  // Set up auto-save when document changes
  useEffect(() => {
    if (!enableCollaboration || !yDoc) return;

    let saveTimeout: NodeJS.Timeout;
    let isInitialLoad = true;

    const handleUpdate = (update: Uint8Array, origin: any) => {
      // Skip auto-save during initial load to avoid overwriting with empty state
      if (isInitialLoad && origin === 'load') return;
      
      console.log('Document auto-saved');
      
      // Debounce saves to avoid too frequent database writes
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveDocumentState(yDoc);
      }, debounceMs);
    };

    // Load initial state
    loadDocumentState(yDoc).then(() => {
      isInitialLoad = false;
    });

    // Listen for changes
    yDoc.on('update', handleUpdate);

    return () => {
      yDoc.off('update', handleUpdate);
      clearTimeout(saveTimeout);
    };
  }, [yDoc, enableCollaboration, saveDocumentState, loadDocumentState, debounceMs]);

  // Manual save function
  const saveManual = useCallback(async () => {
    if (!yDoc) return;

    try {
      await saveDocumentState(yDoc);
      toast({
        title: "Dokument gespeichert",
        description: "Das Dokument wurde erfolgreich gespeichert.",
      });
    } catch (error) {
      toast({
        title: "Fehler beim Speichern",
        description: "Das Dokument konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  }, [yDoc, saveDocumentState, toast]);

  return {
    saveManual,
    loadDocumentState
  };
};