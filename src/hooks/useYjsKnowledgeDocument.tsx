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
      console.log('useYjsKnowledgeDocument: loadDocument called, setting loading to true');
      setIsLoading(true);
      
      const { data: document, error } = await supabase
        .from('knowledge_documents')
        .select('content, yjs_state')
        .eq('id', documentId)
        .maybeSingle();

      if (error) {
        console.error('Error loading document:', error);
        throw error;
      }

      if (document) {
        console.log('Document loaded successfully:', document.content?.length || 0, 'characters');
        setInitialContent(document.content || '');
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

  // Save document to Supabase
  const saveDocument = useCallback(async (content: string, html: string) => {
    try {
      console.log('Saving document:', documentId, 'content length:', content.length, 'html length:', html.length);
      
      // Save both content (plain text) and HTML (formatted content)
      const { error } = await supabase
        .from('knowledge_documents')
        .update({
          content: html || content, // Use HTML if available, fallback to plain text
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) {
        console.error('Save error:', error);
        throw error;
      }
      
      console.log('Document saved successfully with formatting');
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
    
    const loadDoc = async () => {
      try {
        console.log('useYjsKnowledgeDocument: loadDocument called, setting loading to true');
        setIsLoading(true);
        
        const { data: document, error } = await supabase
          .from('knowledge_documents')
          .select('content, yjs_state')
          .eq('id', documentId)
          .maybeSingle();

        if (error) {
          console.error('Error loading document:', error);
          throw error;
        }

        if (document) {
          console.log('Document loaded successfully:', document.content?.length || 0, 'characters');
          setInitialContent(document.content || '');
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
    yjsDoc: yjsDocRef.current,
    isLoading,
    initialContent,
    saveDocument: debouncedSave,
    manualSave: saveDocument
  };
}