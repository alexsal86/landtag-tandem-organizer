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

  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchDocuments = async (page = 0, append = false) => {
    if (!currentTenant) return;
    if (!append) setLoading(true);
    try {
      // Get total count (head-only query, minimal egress)
      if (!append) {
        const { count } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id);
        setTotalDocuments(count || 0);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('documents')
        .select('id, title, description, file_name, file_path, file_size, file_type, category, tags, status, folder_id, document_type, archived_attachments, created_at, updated_at, user_id, tenant_id')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const mappedDocs = (data || []).map(doc => ({
        ...doc,
        archived_attachments: Array.isArray(doc.archived_attachments) ? doc.archived_attachments : []
      })) as Document[];

      if (append) {
        setDocuments(prev => [...prev, ...mappedDocs]);
      } else {
        setDocuments(mappedDocs);
      }

      setHasMore((data?.length || 0) >= PAGE_SIZE);
      setCurrentPage(page);
    } catch (error: unknown) {
      toast({ title: "Fehler beim Laden", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMoreDocuments = () => {
    if (hasMore && !loading) {
      fetchDocuments(currentPage + 1, true);
    }
  };

  const fetchFolders = async () => {
    if (!currentTenant) return;
    try {
      const [foldersResponse, folderDocumentsResponse] = await Promise.all([
        supabase
          .from('document_folders')
          .select('id, name, description, parent_folder_id, order_index, tenant_id, created_at, updated_at, user_id, color, icon')
          .eq('tenant_id', currentTenant.id)
          .order('order_index', { ascending: true }),
        supabase
          .from('documents')
          .select('folder_id')
          .eq('tenant_id', currentTenant.id)
          .not('folder_id', 'is', null),
      ]);

      if (foldersResponse.error) throw foldersResponse.error;
      if (folderDocumentsResponse.error) throw folderDocumentsResponse.error;

      const folderCounts = (folderDocumentsResponse.data || []).reduce((acc: Record<string, number>, doc) => {
        if (!doc.folder_id) return acc;
        acc[doc.folder_id] = (acc[doc.folder_id] || 0) + 1;
        return acc;
      }, {});

      const foldersWithCounts = (foldersResponse.data || []).map((folder) => ({
        ...folder,
        documentCount: folderCounts[folder.id] || 0,
      }));

      setFolders(foldersWithCounts as DocumentFolder[]);
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
        .select('id, title, content, content_html, subject, status, recipient_name, recipient_address, contact_id, sender_info_id, template_id, sent_date, sent_method, expected_response_date, created_by, created_at, updated_at, tenant_id, show_pagination')
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
    fetchDocuments, fetchFolders, fetchLetters, loadMoreDocuments,
    hasMore, totalDocuments, currentPage,
    user, currentTenant,
  };
}
