import { useEffect, useRef, useCallback, useState } from 'react';
import { Doc, encodeStateAsUpdate, applyUpdate } from 'yjs';
import { WebsocketProvider } from 'y-websocket';
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
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialContent, setInitialContent] = useState<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Yjs document with WebSocket provider only once
  useEffect(() => {
    if (!yjsDocRef.current && !providerRef.current) {
      console.log('useYjsKnowledgeDocument: Initializing Yjs document for', documentId);
      const doc = new Doc({ guid: documentId });
      yjsDocRef.current = doc;
      
      // Create WebSocket provider for collaboration
      const wsUrl = 'wss://yjs-websocket-server.fly.dev'; // Public Yjs server
      const provider = new WebsocketProvider(wsUrl, `knowledge-doc-${documentId}`, doc);
      providerRef.current = provider;
      
      // Add provider to doc for access in components
      (doc as any).provider = provider;
      
      console.log('useYjsKnowledgeDocument: Document and provider initialized');
    }
  }, [documentId]);

  // Load document from Supabase and initialize Yjs if needed
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
            // Handle Yjs state (could be base64 string or Uint8Array)
            let yjsStateBytes: Uint8Array;
            if (typeof document.yjs_state === 'string') {
              // Convert base64 string to Uint8Array
              const binaryString = atob(document.yjs_state);
              yjsStateBytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                yjsStateBytes[i] = binaryString.charCodeAt(i);
              }
            } else {
              yjsStateBytes = new Uint8Array(document.yjs_state);
            }
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
        // Convert Uint8Array to base64 string for storage
        const binaryString = Array.from(stateUpdate, byte => String.fromCharCode(byte)).join('');
        yjsStateData = btoa(binaryString);
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
    const loadDoc = async () => {
      // Ensure Yjs document is initialized before loading
      if (!yjsDocRef.current) {
        console.log('useYjsKnowledgeDocument: Waiting for document initialization');
        return;
      }

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
          onError?.(error);
          return;
        }

        console.log('useYjsKnowledgeDocument: Document loaded:', document);

        if (document) {
          // Apply Yjs state if available
          if (document.yjs_state && yjsDocRef.current) {
            console.log('useYjsKnowledgeDocument: Applying Yjs state');
            try {
              // Handle both base64 string and direct Uint8Array
              let yjsStateBytes: Uint8Array;
              if (typeof document.yjs_state === 'string') {
                // Validate and decode base64 string
                const base64String = document.yjs_state;
                // Check if it's a valid base64 string
                if (/^[A-Za-z0-9+/]*={0,2}$/.test(base64String) && base64String.length % 4 === 0) {
                  const binaryString = atob(base64String);
                  yjsStateBytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    yjsStateBytes[i] = binaryString.charCodeAt(i);
                  }
                } else {
                  console.warn('Invalid base64 Yjs state, skipping:', base64String);
                  yjsStateBytes = new Uint8Array(0); // Empty state
                }
              } else {
                yjsStateBytes = new Uint8Array(document.yjs_state);
              }
              
              if (yjsStateBytes.length > 0) {
                applyUpdate(yjsDocRef.current, yjsStateBytes);
                console.log('useYjsKnowledgeDocument: Yjs state applied');
              }
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

    // Only load document after Yjs document is initialized  
    if (yjsDocRef.current) {
      loadDoc();
    }
  }, [documentId, onError]); // Load when document or dependencies change

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (providerRef.current) {
        providerRef.current.destroy();
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