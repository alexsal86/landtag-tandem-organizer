import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import type { DossierSourceWatcher } from "../types";

export function useDossierSourceWatchers(dossierId: string | null) {
  return useQuery({
    queryKey: ["dossier-source-watchers", dossierId],
    enabled: Boolean(dossierId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_source_watchers")
        .select("*")
        .eq("dossier_id", dossierId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DossierSourceWatcher[];
    },
  });
}

export function useCreateDossierSourceWatcher() {
  const qc = useQueryClient();
  const profileId = useCurrentProfileId();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: {
      dossier_id: string;
      source_name: string;
      source_url: string;
      source_type?: "rss" | "presse" | "verband";
      keywords?: string[];
    }) => {
      if (!profileId || !currentTenant?.id) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("dossier_source_watchers").insert({
        dossier_id: input.dossier_id,
        tenant_id: currentTenant.id,
        created_by: profileId,
        source_name: input.source_name,
        source_url: input.source_url,
        source_type: input.source_type ?? "rss",
        keywords: input.keywords ?? [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-source-watchers"] });
      toast.success("Quelle hinzugefügt");
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`),
  });
}

export function useDeleteDossierSourceWatcher() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dossier_source_watchers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-source-watchers"] });
      toast.success("Quelle entfernt");
    },
    onError: (error) => toast.error(`Fehler: ${error.message}`),
  });
}

export function useRunDossierSourceSync() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dossierId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-dossier-external-sources", {
        body: { dossierId },
      });
      if (error) throw error;
      return data as { inserted: number; skipped: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["dossier-entries"] });
      qc.invalidateQueries({ queryKey: ["dossier-entry-counts"] });
      toast.success(`Sync abgeschlossen: ${data.inserted} neu, ${data.skipped} übersprungen`);
    },
    onError: (error) => toast.error(`Sync fehlgeschlagen: ${error.message}`),
  });
}
