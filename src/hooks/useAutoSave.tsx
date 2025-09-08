import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAutoSaveProps {
  documentId: string;
  content: string;
  enabled?: boolean;
  debounceMs?: number;
}

export function useAutoSave({ 
  documentId, 
  content, 
  enabled = true, 
  debounceMs = 2000 
}: UseAutoSaveProps) {
  const { toast } = useToast();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const isSavingRef = useRef<boolean>(false);

  const saveDocument = useCallback(async (contentToSave: string) => {
    if (!enabled || !documentId || isSavingRef.current) return;

    try {
      isSavingRef.current = true;
      
      const { error } = await supabase
        .from('knowledge_documents')
        .update({
          content: contentToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) {
        console.error('Error saving document:', error);
        toast({
          title: "Fehler beim Speichern",
          description: "Das Dokument konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      } else {
        lastSavedContentRef.current = contentToSave;
        console.log('Document auto-saved successfully');
      }
    } catch (error) {
      console.error('Error in auto-save:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      isSavingRef.current = false;
    }
  }, [documentId, enabled, toast]);

  // Auto-save when content changes
  useEffect(() => {
    if (!enabled || !content || content === lastSavedContentRef.current) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      if (content !== lastSavedContentRef.current) {
        saveDocument(content);
      }
    }, debounceMs);

    // Cleanup timeout on unmount or content change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, saveDocument, enabled, debounceMs]);

  // Force save function
  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (content !== lastSavedContentRef.current) {
      saveDocument(content);
    }
  }, [content, saveDocument]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (content !== lastSavedContentRef.current) {
        // Use navigator.sendBeacon for reliable saving on page unload
        const payload = JSON.stringify({
          id: documentId,
          content: content,
          updated_at: new Date().toISOString()
        });
        
        navigator.sendBeacon('/api/save-document', payload);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [documentId, content]);

  return {
    forceSave,
    isSaving: isSavingRef.current,
    lastSavedContent: lastSavedContentRef.current
  };
}