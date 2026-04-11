import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from '@/utils/debugConsole';

export interface Document {
  id: string;
  title: string;
  description?: string;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  category?: string;
  tags?: string[];
  status: string;
  folder_id?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  tenant_id: string;
}

export interface DirectDocument extends Document {
  relationship_type: string;
  relationship_notes?: string;
  document_contact_id: string;
}

export const useContactDocuments = (contactId?: string, contactTags?: string[]) => {
  const [directDocuments, setDirectDocuments] = useState<DirectDocument[]>([]);
  const [taggedDocuments, setTaggedDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentTenant } = useTenant();

  const normalizedContactTags = useMemo(() => contactTags ?? [], [contactTags]);
  const contactTagsKey = useMemo(() => normalizedContactTags.join(','), [normalizedContactTags]);

  const fetchDocuments = useCallback(async () => {
    if (!contactId || !currentTenant?.id) return;

    setLoading(true);
    try {
      const { data: directData, error: directError } = await supabase
        .from('document_contacts')
        .select(`
          id,
          relationship_type,
          notes,
          document:documents (
            id,
            title,
            description,
            file_name,
            file_path,
            file_type,
            file_size,
            category,
            tags,
            status,
            folder_id,
            created_at,
            updated_at,
            user_id,
            tenant_id
          )
        `)
        .eq('contact_id', contactId);

      if (directError) {
        debugConsole.error('Error fetching direct documents:', directError);
        throw directError;
      }

      const directDocs: DirectDocument[] = (directData || [])
        .filter((item) => item.document)
        .map((item) => ({
          ...(item.document as Document),
          relationship_type: item.relationship_type,
          relationship_notes: item.notes || undefined,
          document_contact_id: item.id,
        }));

      setDirectDocuments(directDocs);

      const directDocIds = directDocs.map((doc) => doc.id);

      if (normalizedContactTags.length > 0) {
        let query = supabase
          .from('documents')
          .select('id, title, description, file_name, file_path, file_type, file_size, category, tags, status, folder_id, created_at, updated_at, user_id, tenant_id')
          .eq('tenant_id', currentTenant.id)
          .overlaps('tags', normalizedContactTags);

        if (directDocIds.length > 0) {
          query = query.not('id', 'in', `(${directDocIds.join(',')})`);
        }

        const { data: taggedData, error: taggedError } = await query.order('created_at', { ascending: false });

        if (taggedError) {
          debugConsole.error('Error fetching tagged documents:', taggedError);
          throw taggedError;
        }

        setTaggedDocuments((taggedData || []) as Document[]);
      } else {
        setTaggedDocuments([]);
      }
    } catch (error) {
      debugConsole.error('Error fetching contact documents:', error);
    } finally {
      setLoading(false);
    }
  }, [contactId, currentTenant?.id, normalizedContactTags]);

  const fetchDocumentsRef = useRef(fetchDocuments);

  useEffect(() => {
    fetchDocumentsRef.current = fetchDocuments;
  }, [fetchDocuments]);

  const removeDocumentLink = async (documentContactId: string) => {
    try {
      const { error } = await supabase
        .from('document_contacts')
        .delete()
        .eq('id', documentContactId);

      if (error) throw error;
      await fetchDocumentsRef.current();
    } catch (error: unknown) {
      debugConsole.error('Error removing document link:', error);
      throw error;
    }
  };

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments, contactTagsKey]);

  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`contact-documents-${contactId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_contacts',
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          void fetchDocumentsRef.current();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
        },
        () => {
          void fetchDocumentsRef.current();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [contactId]);

  return {
    directDocuments,
    taggedDocuments,
    loading,
    refreshDocuments: fetchDocuments,
    removeDocumentLink,
  };
};
