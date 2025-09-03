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
    let hasLoaded = false;
    let changeCount = 0;

    const handleUpdate = (update: Uint8Array, origin: any) => {
      changeCount++;
      
      // Skip auto-save during initial load or if no meaningful changes
      if (!hasLoaded) {
        console.log('Skipping auto-save during initial load');
        return;
      }
      
      // Skip empty updates
      if (update.length <= 2) {
        console.log('Skipping empty update');
        return;
      }
      
      console.log(`Document updated (change #${changeCount}), scheduling auto-save in ${debounceMs}ms`);
      
      // Debounce saves to avoid too frequent database writes
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        console.log('Executing auto-save...');
        saveDocumentState(yDoc);
      }, debounceMs);
    };

    // Mark as loaded after initial state is processed
    const markAsLoaded = () => {
      setTimeout(() => {
        hasLoaded = true;
        console.log('Document marked as loaded, auto-save enabled');
      }, 500); // Small delay to ensure initial sync is complete
    };

    // Listen for changes
    yDoc.on('update', handleUpdate);
    
    // Mark as loaded after a brief delay
    markAsLoaded();

    return () => {
      yDoc.off('update', handleUpdate);
      clearTimeout(saveTimeout);
      console.log('Collaboration persistence cleanup');
    };
  }, [yDoc, enableCollaboration, saveDocumentState, debounceMs]);

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