import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import type { DossierEntry } from "../types";

/** Map raw row to DossierEntry with safe defaults */
function mapEntry(d: Record<string, unknown>): DossierEntry {
  return {
    ...d,
    is_pinned: (d.is_pinned as boolean | undefined) ?? false,
    metadata: (d.metadata as Record<string, unknown> | undefined) ?? {},
    tags: (d.tags as string[] | undefined) ?? [],
  } as DossierEntry;
}

/** Inbox entries (dossier_id IS NULL) */
export function useInboxEntries() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossier-entries", "inbox", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_entries")
        .select("*")
        .eq("tenant_id", tenantId!)
        .is("dossier_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapEntry);
    },
  });
}

/** Entries for a specific dossier */
export function useDossierEntries(dossierId: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossier-entries", dossierId, tenantId],
    enabled: !!tenantId && !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_entries")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("dossier_id", dossierId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapEntry);
    },
  });
}

/** Recent entries across all dossiers (D: Mein Radar) */
export function useRecentEntriesAcrossDossiers(daysBack: number = 7) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossier-entries", "radar", tenantId, daysBack],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("dossier_entries")
        .select("*")
        .eq("tenant_id", tenantId!)
        .not("dossier_id", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(mapEntry);
    },
  });
}

/** Global full-text search across all dossier entries (A) */
export function useGlobalEntrySearch(searchTerm: string) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const trimmed = searchTerm.trim();

  return useQuery({
    queryKey: ["dossier-entries", "global-search", tenantId, trimmed],
    enabled: !!tenantId && trimmed.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const pattern = `%${trimmed.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      const { data, error } = await supabase
        .from("dossier_entries")
        .select("*")
        .eq("tenant_id", tenantId!)
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(mapEntry);
    },
  });
}

/** Entry count for a dossier (lightweight) */
export function useDossierEntryCounts(dossierId: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossier-entry-counts", dossierId, tenantId],
    enabled: !!tenantId && !!dossierId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("dossier_entries")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("dossier_id", dossierId!);
      if (error) throw error;
      return { total: count ?? 0, pinned: 0 };
    },
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  return useMutation({
    mutationFn: async (input: {
      dossier_id?: string | null;
      entry_type: string;
      title?: string;
      content?: string;
      source_url?: string;
      file_path?: string;
      file_name?: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!currentTenant?.id || !profileId) throw new Error("Nicht angemeldet");
      const { data, error } = await supabase
        .from("dossier_entries")
        .insert({
          dossier_id: input.dossier_id ?? null,
          entry_type: input.entry_type,
          title: input.title ?? null,
          content: input.content ?? null,
          source_url: input.source_url ?? null,
          file_path: input.file_path ?? null,
          file_name: input.file_name ?? null,
          metadata: input.metadata ?? {},
          tenant_id: currentTenant.id,
          created_by: profileId,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DossierEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-entries"] });
      qc.invalidateQueries({ queryKey: ["dossier-entry-counts"] });
      toast.success("Eintrag gespeichert");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}

export function useAssignEntryToDossier() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, dossierId }: { entryId: string; dossierId: string }) => {
      const { error } = await supabase
        .from("dossier_entries")
        .update({ dossier_id: dossierId })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-entries"] });
      qc.invalidateQueries({ queryKey: ["dossier-entry-counts"] });
      toast.success("Eintrag zugeordnet");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("dossier_entries")
        .delete()
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-entries"] });
      qc.invalidateQueries({ queryKey: ["dossier-entry-counts"] });
      toast.success("Eintrag gelöscht");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}

export function usePinEntry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, pinned }: { entryId: string; pinned: boolean }) => {
      const { error } = await supabase
        .from("dossier_entries")
        .update({ is_pinned: pinned } as never)
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-entries"] });
      toast.success("Eintrag aktualisiert");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}
