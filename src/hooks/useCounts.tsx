import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface CountsData {
  contactsCount: number;
  stakeholdersCount: number;
  archiveCount: number;
  distributionListsCount: number;
  loading: boolean;
}

export function useCounts(): CountsData {
  const [counts, setCounts] = useState<CountsData>({
    contactsCount: 0,
    stakeholdersCount: 0,
    archiveCount: 0,
    distributionListsCount: 0,
    loading: true,
  });

  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const fetchCounts = async () => {
    if (!user || !currentTenant) return;

    try {
      setCounts(prev => ({ ...prev, loading: true }));

      // Get contacts count (persons only, excluding archived)
      const { count: contactsCount, error: contactsError } = await supabase
        .from('contacts')
        .select('id', { count: 'planned', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('contact_type', 'person')
        .neq('name', 'Archivierter Kontakt');

      if (contactsError) {
        console.error('Error fetching contacts count:', contactsError);
      }

      // Get stakeholders count (organizations only)
      const { count: stakeholdersCount, error: stakeholdersError } = await supabase
        .from('contacts')
        .select('id', { count: 'planned', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('contact_type', 'organization');

      if (stakeholdersError) {
        console.error('Error fetching stakeholders count:', stakeholdersError);
      }

      // Get archived contacts count (grouped by phone number)
      const { data: archivedContacts, error: archiveError } = await supabase
        .from('contacts')
        .select('phone')
        .eq('tenant_id', currentTenant.id)
        .eq('name', 'Archivierter Kontakt');

      if (archiveError) {
        console.error('Error fetching archived contacts:', archiveError);
      }

      // Count unique phone numbers for archive
      const uniquePhones = new Set(archivedContacts?.map(c => c.phone).filter(Boolean));
      const archiveCount = uniquePhones.size;

      // Get distribution lists count (including those with null tenant_id)
      const { count: distributionListsCount, error: distributionError } = await supabase
        .from('distribution_lists')
        .select('id', { count: 'planned', head: true })
        .or(`tenant_id.eq.${currentTenant.id},tenant_id.is.null`);

      if (distributionError) {
        console.error('Error fetching distribution lists count:', distributionError);
      }

      console.log('Count debug info:', {
        contactsCount,
        stakeholdersCount,
        archiveCount,
        distributionListsCount,
        tenantId: currentTenant.id
      });

      setCounts({
        contactsCount: contactsCount || 0,
        stakeholdersCount: stakeholdersCount || 0,
        archiveCount,
        distributionListsCount: distributionListsCount || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching counts:', error);
      setCounts(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [user, currentTenant]);

  // Listen for changes to contacts and distribution lists (single channel, debounced)
  useEffect(() => {
    if (!user || !currentTenant) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchCounts(), 2000);
    };

    const channel = supabase
      .channel('counts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        debouncedFetch
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'distribution_lists',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        debouncedFetch
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, currentTenant]);

  return counts;
}
