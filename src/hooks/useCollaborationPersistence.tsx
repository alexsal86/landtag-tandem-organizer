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
  console.log('🔍 useCollaborationPersistence called with:', { documentId, yDoc: !!yDoc, enableCollaboration });
  const { toast } = useToast();

  // Save document state to database
  const saveDocumentState = useCallback(async (doc: Y.Doc) => {
    console.log('🔍 saveDocumentState called with:', { documentId, doc: !!doc });
    if (!documentId || !doc) {
      console.log('🚫 Skipping save - missing documentId or doc');
      return;
    }

    try {
      // Get the current document state as binary
      const state = Y.encodeStateAsUpdate(doc);
      
      // Convert to base64 for database storage  
      const base64State = btoa(String.fromCharCode(...state));
      
      console.log('🔍 About to call RPC with params:', { 
        _document_id: documentId, 
        _yjs_state: base64State?.substring(0, 50) + '...',
        _snapshot_type: 'auto' 
      });

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

  // Load document state from database (improved conflict resolution)
  const loadDocumentState = useCallback(async (doc: Y.Doc) => {
    if (!documentId || !doc) return;

    try {
      console.log('🔍 Loading document state for:', documentId);
      
      // Get the latest document snapshot
      const { data, error } = await supabase
        .from('knowledge_document_snapshots')
        .select('yjs_state, document_version, created_at')
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
          console.log('📦 Applying saved state from:', data.created_at, 'version:', data.document_version);
          
          // Convert from base64 back to Uint8Array
          const binaryString = atob(data.yjs_state);
          const state = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            state[i] = binaryString.charCodeAt(i);
          }
          
          // Check if document already has content before applying update
          const currentState = Y.encodeStateAsUpdate(doc);
          if (currentState.length > 2) {
            console.log('⚠️ Document already has content, merging states...');
            // Merge states instead of overwriting
            Y.applyUpdate(doc, state);
          } else {
            console.log('📄 Document is empty, applying saved state...');
            Y.applyUpdate(doc, state);
          }
          
          console.log('✅ Document state loaded and applied successfully');
        } catch (yError) {
          console.error('❌ Error applying Y.js update:', yError);
          // Skip malformed state data - don't fail the entire process
          console.log('⚠️ Skipping malformed state data, document will start empty');
        }
      } else {
        console.log('ℹ️ No saved state found for document, starting empty');
      }
    } catch (error) {
      console.error('❌ Error in loadDocumentState:', error);
    }
  }, [documentId]);

  // Set up auto-save when document changes (improved conflict resolution)
  useEffect(() => {
    if (!enableCollaboration || !yDoc) return;

    let saveTimeout: NodeJS.Timeout;
    let hasLoaded = false;
    let changeCount = 0;
    let lastSavedState: Uint8Array | null = null;

    const handleUpdate = (update: Uint8Array, origin: any) => {
      changeCount++;
      
      // Skip auto-save during initial load or if no meaningful changes
      if (!hasLoaded) {
        console.log('Skipping auto-save during initial load');
        return;
      }
      
      // Skip updates from network sync (origin will be the WebSocket provider)
      if (origin && origin.constructor && origin.constructor.name === 'WebsocketProvider') {
        console.log('Skipping auto-save for remote update from WebSocket');
        return;
      }
      
      // Skip empty or minimal updates
      if (update.length <= 2) {
        console.log('Skipping empty or minimal update');
        return;
      }

      // Check if this is actually a new state
      const currentState = Y.encodeStateAsUpdate(yDoc);
      if (lastSavedState && areUpdatesEqual(currentState, lastSavedState)) {
        console.log('Skipping auto-save - no actual state change');
        return;
      }
      
      console.log(`Document updated (change #${changeCount}), scheduling auto-save in ${debounceMs}ms`);
      
      // Debounce saves to avoid too frequent database writes
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        console.log('Executing auto-save...');
        const stateToSave = Y.encodeStateAsUpdate(yDoc);
        lastSavedState = stateToSave;
        saveDocumentState(yDoc);
      }, debounceMs);
    };

    // Helper function to compare updates
    const areUpdatesEqual = (update1: Uint8Array, update2: Uint8Array): boolean => {
      if (update1.length !== update2.length) return false;
      for (let i = 0; i < update1.length; i++) {
        if (update1[i] !== update2[i]) return false;
      }
      return true;
    };

    // Mark as loaded after initial state is processed
    const markAsLoaded = () => {
      setTimeout(() => {
        hasLoaded = true;
        // Store initial state
        lastSavedState = Y.encodeStateAsUpdate(yDoc);
        console.log('Document marked as loaded, auto-save enabled');
      }, 1000); // Increased delay to ensure initial sync is complete
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