import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import type { Document, DocumentFolder, Letter } from "../types";

export function useDocumentsData(activeTab: string) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments((data || []).map(doc => ({
        ...doc,
        archived_attachments: Array.isArray(doc.archived_attachments) ? doc.archived_attachments : []
      })) as Document[]);
    } catch (error: unknown) {
      toast({ title: "Fehler beim Laden", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    if (!currentTenant) return;
    try {
      const { data, error } = await supabase
        .from('document_folders')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      const foldersWithCounts = await Promise.all((data || []).map(async (folder) => {
        const { count } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('folder_id', folder.id);
        return { ...folder, documentCount: count || 0 };
      }));
      setFolders(foldersWithCounts);
    } catch (error: unknown) {
      debugConsole.error('Error fetching folders:', error);
    }
  };

  const fetchLetters = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letters')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLetters((data || []) as Letter[]);
    } catch (error: unknown) {
      toast({ title: "Fehler beim Laden der Briefe", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && currentTenant) {
      if (activeTab === 'documents') {
        fetchDocuments();
        fetchFolders();
      } else {
        fetchLetters();
      }
    }
  }, [user, currentTenant, activeTab]);

  return {
    documents, letters, folders, loading, setLoading,
    fetchDocuments, fetchFolders, fetchLetters,
    user, currentTenant,
  };
}
