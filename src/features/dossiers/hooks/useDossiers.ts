import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import type { Dossier } from "../types";

export function useDossiers() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossiers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Dossier[];
    },
  });
}

export function useCreateDossier() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  return useMutation({
    mutationFn: async (input: { title: string; summary?: string; status?: string; priority?: string }) => {
      if (!currentTenant?.id || !profileId) throw new Error("Nicht angemeldet");
      const { data, error } = await supabase
        .from("dossiers")
        .insert({
          title: input.title,
          summary: input.summary ?? null,
          status: input.status ?? "aktiv",
          priority: input.priority ?? "mittel",
          tenant_id: currentTenant.id,
          created_by: profileId,
          owner_id: profileId,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as Dossier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success("Dossier erstellt");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}

export function useUpdateDossier() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; title?: string; summary?: string; status?: string; priority?: string }) => {
      const { id, ...updates } = input;
      const { error } = await supabase
        .from("dossiers")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success("Dossier aktualisiert");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}
