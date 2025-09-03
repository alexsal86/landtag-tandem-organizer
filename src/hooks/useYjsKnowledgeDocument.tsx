import { useCallback, useEffect, useRef, useState } from 'react';
import { Doc, encodeStateAsUpdate, applyUpdate } from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UseYjsKnowledgeDocumentProps {
  documentId: string;
  onError?: (error: Error) => void;
}

// Helper function to generate random user colors
function generateUserColor(): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function useYjsKnowledgeDocument({
  documentId,
  onError
}: UseYjsKnowledgeDocumentProps) {
  const { user } = useAuth();
  const yjsDocRef = useRef<Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialContent, setInitialContent] = useState<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Yjs document and awareness on documentId change
  useEffect(() => {
    console.log('useYjsKnowledgeDocument: Initializing Yjs document for:', documentId);
    
    if (yjsDocRef.current) {
      yjsDocRef.current.destroy();
    }
    
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
    }
    
    if (documentId) {
      const doc = new Doc({ guid: documentId });
      yjsDocRef.current = doc;
      
      // Initialize awareness for user identification
      const awareness = new Awareness(doc);
      awarenessRef.current = awareness;
      
      // Set user information in awareness if user is available
      if (user) {
        awareness.setLocalStateField('user', {
          name: user.email || 'Anonymous User',
          color: generateUserColor(),
          clientId: doc.clientID
        });
      }
      
      console.log('useYjsKnowledgeDocument: Document and awareness initialized');
    }
  }, [documentId, user]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (awarenessRef.current) {
        awarenessRef.current.destroy();
      }
      if (yjsDocRef.current) {
        yjsDocRef.current.destroy();
      }
    };
  }, []);

  return {
    yjsDoc: yjsDocRef.current,
    awareness: awarenessRef.current,
    isLoading,
    initialContent,
    saveDocument: debouncedSave,
    manualSave: saveDocument
  };
}