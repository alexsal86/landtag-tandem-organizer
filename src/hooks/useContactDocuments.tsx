import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

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
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const fetchDocuments = async () => {
    if (!contactId || !currentTenant?.id) return;

    setLoading(true);
    try {
      // Fetch directly linked documents via document_contacts
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
        console.error('Error fetching direct documents:', directError);
        throw directError;
      }

      const directDocs: DirectDocument[] = (directData || [])
        .filter(item => item.document)
        .map(item => ({
          ...(item.document as Document),
          relationship_type: item.relationship_type,
          relationship_notes: item.notes || undefined,
          document_contact_id: item.id,
        }));

      setDirectDocuments(directDocs);

      // Get IDs of directly linked documents to exclude them from tag-based search
      const directDocIds = directDocs.map(doc => doc.id);

      // Fetch tag-based documents (documents that share at least one tag with contact)
      if (contactTags && contactTags.length > 0) {
        let query = supabase
          .from('documents')
          .select('id, title, description, file_name, file_path, file_type, file_size, category, tags, status, folder_id, created_at, updated_at, user_id, tenant_id')
          .eq('tenant_id', currentTenant.id)
          .overlaps('tags', contactTags);
        
        // Only exclude direct docs if there are any
        if (directDocIds.length > 0) {
          query = query.not('id', 'in', `(${directDocIds.join(',')})`);
        }
        
        const { data: taggedData, error: taggedError } = await query
          .order('created_at', { ascending: false });

        if (taggedError) {
          console.error('Error fetching tagged documents:', taggedError);
          throw taggedError;
        }
        
        setTaggedDocuments((taggedData || []) as Document[]);
      } else {
        setTaggedDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching contact documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeDocumentLink = async (documentContactId: string) => {
    try {
      const { error } = await supabase
        .from('document_contacts')
        .delete()
        .eq('id', documentContactId);

      if (error) throw error;
      await fetchDocuments();
    } catch (error: any) {
      console.error('Error removing document link:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [contactId, currentTenant, contactTags?.join(',')]);

  // Real-time updates for document_contacts
  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`contact-documents-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_contacts',
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          fetchDocuments();
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
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
