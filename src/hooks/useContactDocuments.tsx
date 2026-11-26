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
  /** Legacy field, kept for older callers; new links live in topic_ids. */
  tags?: string[];
  topic_ids?: string[];
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

export const useContactDocuments = (contactId?: string, contactTopicIds?: string[]) => {
  const [directDocuments, setDirectDocuments] = useState<DirectDocument[]>([]);
  const [taggedDocuments, setTaggedDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentTenant } = useTenant();

  const topicIdsKey = useMemo(
    () => [...new Set(contactTopicIds ?? [])].sort().join(','),
    [contactTopicIds],
  );
  const normalizedTopicIds = useMemo(
    () => (topicIdsKey ? topicIdsKey.split(',') : []),
    [topicIdsKey],
  );

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
        .filter((item: Record<string, any>) => item.document)
        .map((item: Record<string, any>) => ({
          ...(item.document as Document),
          relationship_type: item.relationship_type,
          relationship_notes: item.notes || undefined,
          document_contact_id: item.id,
        }));

      const directDocIds = new Set(directDocs.map((doc) => doc.id));
      let taggedIds: string[] = [];

      if (normalizedTopicIds.length > 0) {
        const { data: links, error: linkError } = await supabase
          .from('document_topics')
          .select('document_id')
          .eq('tenant_id', currentTenant.id)
          .in('topic_id', normalizedTopicIds);

        if (linkError) {
          debugConsole.error('Error fetching topic-linked documents:', linkError);
          throw linkError;
        }

        taggedIds = [...new Set(
          ((links ?? []) as Array<{ document_id: string }>).map((link) => link.document_id),
        )].filter((id) => !directDocIds.has(id));
      }

      let taggedDocs: Document[] = [];
      if (taggedIds.length > 0) {
        const { data: taggedData, error: taggedError } = await supabase
          .from('documents')
          .select('id, title, description, file_name, file_path, file_type, file_size, category, status, folder_id, created_at, updated_at, user_id, tenant_id')
          .eq('tenant_id', currentTenant.id)
          .in('id', taggedIds)
          .order('created_at', { ascending: false });

        if (taggedError) {
          debugConsole.error('Error fetching tagged documents:', taggedError);
          throw taggedError;
        }
        taggedDocs = (taggedData || []) as Document[];
      }

      const allDocIds = [...new Set([...directDocIds, ...taggedDocs.map((doc) => doc.id)])];
      const topicMap: Record<string, string[]> = {};
      if (allDocIds.length > 0) {
        const { data: topicLinks, error: topicError } = await supabase
          .from('document_topics')
          .select('document_id, topic_id')
          .eq('tenant_id', currentTenant.id)
          .in('document_id', allDocIds);

        if (topicError) {
          debugConsole.error('Error fetching document topics:', topicError);
          throw topicError;
        }
        for (const link of topicLinks ?? []) {
          topicMap[link.document_id] = [...(topicMap[link.document_id] ?? []), link.topic_id];
        }
      }

      setDirectDocuments(directDocs.map((doc) => ({
        ...doc,
        topic_ids: topicMap[doc.id] ?? [],
      })));
      setTaggedDocuments(taggedDocs.map((doc) => ({
        ...doc,
        topic_ids: topicMap[doc.id] ?? [],
      })));
    } catch (error) {
      debugConsole.error('Error fetching contact documents:', error);
    } finally {
      setLoading(false);
    }
  }, [contactId, currentTenant?.id, normalizedTopicIds]);

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
  }, [fetchDocuments, topicIdsKey]);

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
