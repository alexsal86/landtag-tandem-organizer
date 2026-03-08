import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { debugConsole } from '@/utils/debugConsole';

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
        debugConsole.error('Error saving document:', error);
        toast({
          title: "Fehler beim Speichern",
          description: "Das Dokument konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      } else {
        lastSavedContentRef.current = contentToSave;
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

  useEffect(() => {
    if (!enabled || !content || content === lastSavedContentRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (content !== lastSavedContentRef.current) {
        saveDocument(content);
      }
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, saveDocument, enabled, debounceMs]);

  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (content !== lastSavedContentRef.current) {
      saveDocument(content);
    }
  }, [content, saveDocument]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (content !== lastSavedContentRef.current) {
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
