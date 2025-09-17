import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Contact } from "@/hooks/useInfiniteContacts";

export const useAllPersonContacts = () => {
  const [personContacts, setPersonContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const fetchPersonContacts = useCallback(async () => {
    if (!user || !currentTenant) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('contact_type', 'person')
        .neq('name', 'Archivierter Kontakt')
        .order('name');

      if (error) {
        console.error('Error fetching person contacts:', error);
        return;
      }

      setPersonContacts((contacts || []) as Contact[]);
    } catch (error) {
      console.error('Error in fetchPersonContacts:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant]);

  useEffect(() => {
    fetchPersonContacts();
  }, [fetchPersonContacts]);

  // Listen for changes to contacts
  useEffect(() => {
    if (!user || !currentTenant) return;

    const contactsChannel = supabase
      .channel('person-contacts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          fetchPersonContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
    };
  }, [user, currentTenant, fetchPersonContacts]);

  return {
    personContacts,
    loading,
    refreshPersonContacts: fetchPersonContacts
  };
};