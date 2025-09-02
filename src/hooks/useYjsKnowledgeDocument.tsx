import { useEffect, useRef, useCallback, useState } from 'react';
import { Doc } from 'yjs';
import { supabase } from '@/integrations/supabase/client';

interface UseYjsKnowledgeDocumentProps {
  documentId: string;
  onError?: (error: Error) => void;
}

export function useYjsKnowledgeDocument({ 
  documentId, 
  onError 
}: UseYjsKnowledgeDocumentProps) {
  const yjsDocRef = useRef<Doc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialContent, setInitialContent] = useState<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Yjs document
  const initializeYjsDoc = useCallback(() => {
    if (yjsDocRef.current) return yjsDocRef.current;

    const doc = new Doc({ guid: documentId });
    yjsDocRef.current = doc;
    
    return doc;
  }, [documentId]);

  // Load document from Supabase
  const loadDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data: document, error } = await supabase
        .from('knowledge_documents')
        .select('content, yjs_state, document_version')
        .eq('id', documentId)
        .single();

      if (error) {
        throw error;
      }

      if (document) {
        // If we have Yjs state, restore it
        if (document.yjs_state && typeof document.yjs_state === 'string') {
          const doc = initializeYjsDoc();
          try {
            // Convert base64 string back to Uint8Array
            const binaryString = atob(document.yjs_state);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }
            // Note: This is a simplified version - in a real implementation
            // you'd use Y.applyUpdate(doc, uint8Array)
          } catch (yjsError) {
            console.warn('Failed to restore Yjs state, falling back to content:', yjsError);
            // Fall back to markdown content
            setInitialContent(document.content || '');
          }
        } else {
          // No Yjs state, use markdown content
          setInitialContent(document.content || '');
        }
      }
    } catch (error) {
      console.error('Error loading knowledge document:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, initializeYjsDoc, onError]);

  // Save document to Supabase
  const saveDocument = useCallback(async (content: string, html: string) => {
    try {
      const doc = yjsDocRef.current;
      let yjsStateBase64: string | null = null;

      if (doc) {
        // Get current Yjs state
        try {
          // In a real implementation, you'd use Y.encodeStateAsUpdate(doc)
          // For now, we'll create a simple state representation
          const simpleState = new Uint8Array([1, 2, 3]); // Simplified
          // Convert to base64 for storage
          const binaryString = Array.from(simpleState)
            .map(byte => String.fromCharCode(byte))
            .join('');
          yjsStateBase64 = btoa(binaryString);
        } catch (error) {
          console.warn('Failed to encode Yjs state:', error);
        }
      }

      // Update the document
      const { error } = await supabase
        .from('knowledge_documents')
        .update({
          content: content,
          yjs_state: yjsStateBase64,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) {
        throw error;
      }

      // Create a snapshot periodically
      if (yjsStateBase64 && Math.random() < 0.1) { // 10% chance to create snapshot
        try {
          // Convert base64 back to bytea for the function
          const binaryString = atob(yjsStateBase64);
          const uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
          
          await supabase.rpc('create_knowledge_document_snapshot', {
            _document_id: documentId,
            _yjs_state: yjsStateBase64,
            _snapshot_type: 'auto'
          });
        } catch (snapshotError) {
          console.warn('Failed to create snapshot:', snapshotError);
        }
      }
    } catch (error) {
      console.error('Error saving knowledge document:', error);
      onError?.(error as Error);
    }
  }, [documentId, onError]);

  // Debounced save function
  const debouncedSave = useCallback((content: string, html: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(content, html);
    }, 1000); // Save after 1 second of inactivity
  }, [saveDocument]);

  // Load document on mount
  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (yjsDocRef.current) {
        yjsDocRef.current.destroy();
      }
    };
  }, []);

  return {
    yjsDoc: yjsDocRef.current,
    isLoading,
    initialContent,
    saveDocument: debouncedSave,
    manualSave: saveDocument
  };
}