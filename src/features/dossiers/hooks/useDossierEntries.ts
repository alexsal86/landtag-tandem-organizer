import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import type { DossierEntry } from "../types";

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
      return (data ?? []).map((d) => ({ ...d, is_pinned: (d as Record<string, unknown>).is_pinned ?? false, metadata: d.metadata ?? {} })) as DossierEntry[];
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
      return (data ?? []).map((d) => ({ ...d, is_pinned: (d as Record<string, unknown>).is_pinned ?? false, metadata: d.metadata ?? {} })) as DossierEntry[];
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
