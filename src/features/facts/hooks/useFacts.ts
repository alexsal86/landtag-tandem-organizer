import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import type { FactsFilters, FactInput, FactRow } from "../types";
import { notify } from "@/lib/notify";

export function useFacts(filters: FactsFilters = {}) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const sortField = filters.sortField ?? "updated_at";
  const sortDir = filters.sortDir ?? "desc";

  return useQuery({
    queryKey: ["facts", tenantId, filters],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("facts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order(sortField, { ascending: sortDir === "asc", nullsFirst: false })
        .limit(500);

      if (!filters.includeArchived) q = q.eq("is_archived", false);
      if (filters.dossierId) q = q.eq("dossier_id", filters.dossierId);
      if (filters.contactId) q = q.eq("contact_id", filters.contactId);
      if (filters.tags && filters.tags.length > 0) q = q.contains("tags", filters.tags);
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim().replace(/[%,]/g, " ");
        q = q.or(`text.ilike.%${term}%,source.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FactRow[];
    },
  });
}

export function useFactsPaginated(filters: FactsFilters = {}) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const sortField = filters.sortField ?? "updated_at";
  const sortDir = filters.sortDir ?? "desc";
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 25;

  return useQuery({
    queryKey: ["facts-paginated", tenantId, filters],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("facts")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId!)
        .order(sortField, { ascending: sortDir === "asc", nullsFirst: false })
        .range(from, to);

      if (!filters.includeArchived) q = q.eq("is_archived", false);
      if (filters.dossierId) q = q.eq("dossier_id", filters.dossierId);
      if (filters.contactId) q = q.eq("contact_id", filters.contactId);
      if (filters.tags && filters.tags.length > 0) q = q.contains("tags", filters.tags);
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim().replace(/[%,]/g, " ");
        q = q.or(`text.ilike.%${term}%,source.ilike.%${term}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as FactRow[], total: count ?? 0, page, pageSize };
    },
  });
}

export function useFactById(id: string | null | undefined) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["fact", id, currentTenant?.id],
    enabled: !!id && !!currentTenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as FactRow | null;
    },
  });
}

export function useUpsertFact() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  return useMutation({
    mutationFn: async (input: FactInput): Promise<string> => {
      if (!currentTenant?.id || !profileId) throw new Error("Nicht angemeldet");
      const payload = {
        text: input.text,
        source: input.source ?? null,
        tags: input.tags ?? [],
        dossier_id: input.dossier_id ?? null,
        contact_id: input.contact_id ?? null,
        valid_until: input.valid_until ?? null,
        is_archived: input.is_archived ?? false,
      };
      if (input.id) {
        const { error } = await supabase.from("facts").update(payload).eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("facts")
        .insert({ ...payload, tenant_id: currentTenant.id, created_by: profileId })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Fakt konnte nicht erstellt werden");
      return data.id;
    },
    onSuccess: () => {
      (qc.invalidateQueries({ queryKey: ["facts"] }), qc.invalidateQueries({ queryKey: ["facts-paginated"] }));
    },
    onError: (e: Error) => notify.error(`Fehler: ${e.message}`),
  });
}

export function useArchiveFact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("facts").update({ is_archived: archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => (qc.invalidateQueries({ queryKey: ["facts"] }), qc.invalidateQueries({ queryKey: ["facts-paginated"] })),
    onError: (e: Error) => notify.error(`Fehler: ${e.message}`),
  });
}

export function useDeleteFact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("facts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      (qc.invalidateQueries({ queryKey: ["facts"] }), qc.invalidateQueries({ queryKey: ["facts-paginated"] }));
      notify.success("Fakt gelöscht");
    },
    onError: (e: Error) => notify.error(`Fehler: ${e.message}`),
  });
}

export function useIncrementFactUsage() {
  return useMutation({
    mutationFn: async (factId: string) => {
      const { error } = await supabase.rpc("increment_fact_usage", { _fact_id: factId });
      if (error) throw error;
    },
  });
}
