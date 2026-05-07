import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

const EMPTY_COUNTS: Omit<CountsData, "loading"> = {
  contactsCount: 0,
  stakeholdersCount: 0,
  archiveCount: 0,
  distributionListsCount: 0,
};

async function fetchContactsCount(tenantId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("contacts")
    .select("id", { count: "planned", head: true })
    .eq("tenant_id", tenantId)
    .eq("contact_type", "person")
    .neq("name", "Archivierter Kontakt");
  if (error) {
    debugConsole.error("Error fetching contacts count fallback:", error);
    return null;
  }
  return count ?? 0;
}

async function fetchStakeholdersCount(tenantId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("contacts")
    .select("id", { count: "planned", head: true })
    .eq("tenant_id", tenantId)
    .eq("contact_type", "organization");
  if (error) {
    debugConsole.error("Error fetching stakeholders count fallback:", error);
    return null;
  }
  return count ?? 0;
}

async function fetchDistributionListsCount(tenantId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from("distribution_lists")
    .select("id", { count: "exact", head: true })
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  if (error) {
    debugConsole.error("Error fetching distribution lists count fallback:", error);
    return null;
  }
  return count ?? 0;
}

async function fetchCounts(tenantId: string): Promise<Omit<CountsData, "loading">> {
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_contact_counts", {
    p_tenant_id: tenantId,
  });

  if (rpcError) {
    debugConsole.error("Error fetching counts via RPC:", rpcError);
  }

  const rpcCounts = rpcData && typeof rpcData === "object"
    ? (rpcData as Partial<Omit<CountsData, "loading">>)
    : {};

  const contactsCount = typeof rpcCounts.contactsCount === "number" ? rpcCounts.contactsCount : null;
  const stakeholdersCount = typeof rpcCounts.stakeholdersCount === "number" ? rpcCounts.stakeholdersCount : null;
  const archiveCount = typeof rpcCounts.archiveCount === "number" ? rpcCounts.archiveCount : null;
  const distributionListsCount = typeof rpcCounts.distributionListsCount === "number" ? rpcCounts.distributionListsCount : null;

  if (
    contactsCount !== null &&
    stakeholdersCount !== null &&
    archiveCount !== null &&
    distributionListsCount !== null
  ) {
    return { contactsCount, stakeholdersCount, archiveCount, distributionListsCount };
  }

  debugConsole.error("Partial RPC counts payload detected. Falling back per field.", { rpcCounts });

  const [fallbackContacts, fallbackStakeholders, fallbackDistributionLists] = await Promise.all([
    contactsCount === null ? fetchContactsCount(tenantId) : Promise.resolve(contactsCount),
    stakeholdersCount === null ? fetchStakeholdersCount(tenantId) : Promise.resolve(stakeholdersCount),
    distributionListsCount === null ? fetchDistributionListsCount(tenantId) : Promise.resolve(distributionListsCount),
  ]);

  return {
    contactsCount: fallbackContacts ?? 0,
    stakeholdersCount: fallbackStakeholders ?? 0,
    archiveCount: archiveCount ?? 0,
    distributionListsCount: fallbackDistributionLists ?? 0,
  };
}

export function useCounts(): CountsData {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;
  const queryKey = ["counts", tenantId] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchCounts(tenantId as string),
    enabled: !!user && !!tenantId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Realtime invalidation (debounced)
  useEffect(() => {
    if (!user || !tenantId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
      }, 600);
    };

    const channelName = `counts-changes-${tenantId}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts", filter: `tenant_id=eq.${tenantId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "distribution_lists", filter: `tenant_id=eq.${tenantId}` },
        invalidate,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, tenantId, queryClient]);

  return {
    ...(data ?? EMPTY_COUNTS),
    loading: isLoading,
  };
}
