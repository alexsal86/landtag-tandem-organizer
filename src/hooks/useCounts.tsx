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
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('contact_type', 'person')
        .neq('name', 'Archivierter Kontakt');

      if (contactsError) {
        console.error('Error fetching contacts count:', contactsError);
      }

      // Get stakeholders count (organizations only)
      const { count: stakeholdersCount, error: stakeholdersError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
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

      // Get distribution lists count
      const { count: distributionListsCount, error: distributionError } = await supabase
        .from('distribution_lists')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id);

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

  // Listen for changes to contacts and distribution lists
  useEffect(() => {
    if (!user || !currentTenant) return;

    const contactsChannel = supabase
      .channel('contacts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    const distributionListsChannel = supabase
      .channel('distribution-lists-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'distribution_lists',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(distributionListsChannel);
    };
  }, [user, currentTenant]);

  return counts;
}