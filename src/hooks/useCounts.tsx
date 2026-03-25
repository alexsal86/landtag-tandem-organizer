import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";

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

  const fetchContactsCount = async (tenantId: string): Promise<number | null> => {
    const { count, error } = await supabase
      .from('contacts')
      .select('id', { count: 'planned', head: true })
      .eq('tenant_id', tenantId)
      .eq('contact_type', 'person')
      .neq('name', 'Archivierter Kontakt');

    if (error) {
      debugConsole.error('Error fetching contacts count fallback:', error);
      return null;
    }

    return count ?? 0;
  };

  const fetchStakeholdersCount = async (tenantId: string): Promise<number | null> => {
    const { count, error } = await supabase
      .from('contacts')
      .select('id', { count: 'planned', head: true })
      .eq('tenant_id', tenantId)
      .eq('contact_type', 'organization');

    if (error) {
      debugConsole.error('Error fetching stakeholders count fallback:', error);
      return null;
    }

    return count ?? 0;
  };

  const fetchDistributionListsCount = async (tenantId: string): Promise<number | null> => {
    const { count, error } = await supabase
      .from('distribution_lists')
      .select('id', { count: 'exact', head: true })
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    if (error) {
      debugConsole.error('Error fetching distribution lists count fallback:', error);
      return null;
    }

    return count ?? 0;
  };

  const fetchCounts = async () => {
    if (!user || !currentTenant) return;

    try {
      setCounts(prev => ({ ...prev, loading: true }));

      const tenantId = currentTenant.id;
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_contact_counts', {
        p_tenant_id: tenantId,
      });

      if (rpcError) {
        debugConsole.error('Error fetching counts via RPC:', rpcError);
      }

      const rpcCounts = rpcData && typeof rpcData === 'object'
        ? rpcData as Partial<Omit<CountsData, 'loading'>>
        : {};

      const contactsCount = typeof rpcCounts.contactsCount === 'number' ? rpcCounts.contactsCount : null;
      const stakeholdersCount = typeof rpcCounts.stakeholdersCount === 'number' ? rpcCounts.stakeholdersCount : null;
      const archiveCount = typeof rpcCounts.archiveCount === 'number' ? rpcCounts.archiveCount : null;
      const distributionListsCount = typeof rpcCounts.distributionListsCount === 'number' ? rpcCounts.distributionListsCount : null;

      if (contactsCount !== null && stakeholdersCount !== null && archiveCount !== null && distributionListsCount !== null) {
        setCounts({
          contactsCount,
          stakeholdersCount,
          archiveCount,
          distributionListsCount,
          loading: false,
        });
        return;
      }

      debugConsole.error('Partial RPC counts payload detected. Falling back per field.', {
        rpcCounts,
      });

      const fallbackResults = await Promise.all([
        contactsCount === null ? fetchContactsCount(tenantId) : Promise.resolve(contactsCount),
        stakeholdersCount === null ? fetchStakeholdersCount(tenantId) : Promise.resolve(stakeholdersCount),
        Promise.resolve(archiveCount),
        distributionListsCount === null ? fetchDistributionListsCount(tenantId) : Promise.resolve(distributionListsCount),
      ]);

      const [fallbackContacts, fallbackStakeholders, fallbackArchive, fallbackDistributionLists] = fallbackResults;

      setCounts(prev => ({
        contactsCount: fallbackContacts ?? prev.contactsCount,
        stakeholdersCount: fallbackStakeholders ?? prev.stakeholdersCount,
        archiveCount: fallbackArchive ?? prev.archiveCount,
        distributionListsCount: fallbackDistributionLists ?? prev.distributionListsCount,
        loading: false,
      }));
    } catch (error) {
      debugConsole.error('Error fetching counts:', error);
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
      debounceTimer = setTimeout(() => fetchCounts(), 600);
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
