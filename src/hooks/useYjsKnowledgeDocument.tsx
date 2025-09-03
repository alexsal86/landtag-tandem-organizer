import { useEffect, useRef, useCallback, useState } from 'react';
import { Doc, encodeStateAsUpdate, applyUpdate } from 'yjs';
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
      console.log('useYjsKnowledgeDocument: loadDocument called, setting loading to true');
      setIsLoading(true);
      
      const { data: document, error } = await supabase
        .from('knowledge_documents')
        .select('content, content_html, yjs_state, document_version')
        .eq('id', documentId)
        .maybeSingle();

      if (error) {
        console.error('Error loading document:', error);
        throw error;
      }

      if (document) {
        console.log('Document loaded successfully:', document.content?.length || 0, 'characters');
        
         // Initialize Yjs document if state exists
        if (document.yjs_state && yjsDocRef.current) {
          try {
            // Convert base64 string to Uint8Array if needed
            const yjsStateBytes = typeof document.yjs_state === 'string' 
              ? new Uint8Array(Buffer.from(document.yjs_state, 'base64'))
              : new Uint8Array(document.yjs_state);
            applyUpdate(yjsDocRef.current, yjsStateBytes);
            console.log('useYjsKnowledgeDocument: Yjs state applied');
          } catch (yjsError) {
            console.error('useYjsKnowledgeDocument: Error applying Yjs state:', yjsError);
          }
        }
        
        // Prioritize HTML content over plain text
        const contentToUse = document.content_html || document.content || '';
        setInitialContent(contentToUse);
      } else {
        console.log('No document found, using empty content');
        setInitialContent('');
      }
    } catch (error) {
      console.error('Error loading knowledge document:', error);
      onError?.(error as Error);
    } finally {
      console.log('useYjsKnowledgeDocument: Setting loading to false');
      setIsLoading(false);
    }
  }, [documentId, onError]);

  // Save document to Supabase with both HTML and Yjs state
  const saveDocument = useCallback(async (content: string, html: string) => {
    try {
      console.log('Saving document:', documentId, 'content length:', content.length, 'html length:', html.length);
      
      // Get Yjs state if document exists
      let yjsStateData = null;
      if (yjsDocRef.current) {
        const stateUpdate = encodeStateAsUpdate(yjsDocRef.current);
        yjsStateData = Buffer.from(stateUpdate).toString('base64');
      }
      
      const updateData: any = {
        content: content, // Plain text content
        content_html: html, // Formatted HTML content
        updated_at: new Date().toISOString()
      };
      
      // Include Yjs state if available
      if (yjsStateData) {
        updateData.yjs_state = yjsStateData;
      }
      
      const { error } = await supabase
        .from('knowledge_documents')
        .update(updateData)
        .eq('id', documentId);

      if (error) {
        console.error('Save error:', error);
        throw error;
      }
      
      console.log('Document saved successfully with formatting and Yjs state');
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

  // Load document on mount (only when documentId changes)
  useEffect(() => {
    console.log('useYjsKnowledgeDocument: useEffect triggered for documentId:', documentId);
    
    // Initialize Yjs doc first
    initializeYjsDoc();
    
    const loadDoc = async () => {
      try {
        console.log('useYjsKnowledgeDocument: loadDocument called, setting loading to true');
        setIsLoading(true);
        
        const { data: document, error } = await supabase
          .from('knowledge_documents')
          .select('content, content_html, yjs_state, document_version')
          .eq('id', documentId)
          .maybeSingle();

        if (error) {
          console.error('Error loading document:', error);
          throw error;
        }

        if (document) {
          console.log('Document loaded successfully:', document.content?.length || 0, 'characters');
          
          // Initialize Yjs document if state exists
          if (document.yjs_state && yjsDocRef.current) {
            try {
              // Convert base64 string to Uint8Array if needed
              const yjsStateBytes = typeof document.yjs_state === 'string' 
                ? new Uint8Array(Buffer.from(document.yjs_state, 'base64'))
                : new Uint8Array(document.yjs_state);
              applyUpdate(yjsDocRef.current, yjsStateBytes);
              console.log('useYjsKnowledgeDocument: Yjs state applied');
            } catch (yjsError) {
              console.error('useYjsKnowledgeDocument: Error applying Yjs state:', yjsError);
            }
          }
          
          // Prioritize HTML content over plain text
          const contentToUse = document.content_html || document.content || '';
          setInitialContent(contentToUse);
        } else {
          console.log('No document found, using empty content');
          setInitialContent('');
        }
      } catch (error) {
        console.error('Error loading knowledge document:', error);
        onError?.(error as Error);
      } finally {
        console.log('useYjsKnowledgeDocument: Setting loading to false');
        setIsLoading(false);
      }
    };

    loadDoc();
  }, [documentId, onError]); // Stable dependencies

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
    yjsDoc: yjsDocRef.current || initializeYjsDoc(),
    isLoading,
    initialContent,
    saveDocument: debouncedSave,
    manualSave: saveDocument
  };
}