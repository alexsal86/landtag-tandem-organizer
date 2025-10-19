import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

export interface DocumentContact {
  id: string;
  document_id: string;
  contact_id: string;
  relationship_type: string;
  notes?: string;
  created_at: string;
  created_by: string;
  contact?: {
    id: string;
    name: string;
    contact_type: string;
    email?: string;
    phone?: string;
    organization?: string;
    avatar_url?: string;
  };
}

export const useDocumentContacts = (documentId?: string) => {
  const [documentContacts, setDocumentContacts] = useState<DocumentContact[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const fetchDocumentContacts = async () => {
    if (!documentId || !currentTenant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_contacts')
        .select(`
          *,
          contact:contacts(
            id,
            name,
            contact_type,
            email,
            phone,
            organization,
            avatar_url
          )
        `)
        .eq('document_id', documentId);

      if (error) throw error;
      setDocumentContacts(data as DocumentContact[]);
    } catch (error) {
      console.error('Error fetching document contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const addDocumentContact = async (
    contactId: string,
    relationshipType: string = 'related',
    notes?: string
  ) => {
    if (!documentId || !user) return;

    try {
      const { error } = await supabase
        .from('document_contacts')
        .insert({
          document_id: documentId,
          contact_id: contactId,
          relationship_type: relationshipType,
          notes,
          created_by: user.id,
        });

      if (error) throw error;
      await fetchDocumentContacts();
    } catch (error: any) {
      console.error('Error adding document contact:', error);
      throw error;
    }
  };

  const removeDocumentContact = async (documentContactId: string) => {
    try {
      const { error } = await supabase
        .from('document_contacts')
        .delete()
        .eq('id', documentContactId);

      if (error) throw error;
      await fetchDocumentContacts();
    } catch (error: any) {
      console.error('Error removing document contact:', error);
      throw error;
    }
  };

  const updateDocumentContact = async (
    documentContactId: string,
    relationshipType?: string,
    notes?: string
  ) => {
    try {
      const updateData: any = {};
      if (relationshipType !== undefined) updateData.relationship_type = relationshipType;
      if (notes !== undefined) updateData.notes = notes;

      const { error } = await supabase
        .from('document_contacts')
        .update(updateData)
        .eq('id', documentContactId);

      if (error) throw error;
      await fetchDocumentContacts();
    } catch (error: any) {
      console.error('Error updating document contact:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchDocumentContacts();
  }, [documentId, currentTenant]);

  // Real-time updates
  useEffect(() => {
    if (!documentId) return;

    const channel = supabase
      .channel(`document-contacts-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_contacts',
          filter: `document_id=eq.${documentId}`,
        },
        () => {
          fetchDocumentContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  return {
    documentContacts,
    loading,
    addDocumentContact,
    removeDocumentContact,
    updateDocumentContact,
    refreshDocumentContacts: fetchDocumentContacts,
  };
};
