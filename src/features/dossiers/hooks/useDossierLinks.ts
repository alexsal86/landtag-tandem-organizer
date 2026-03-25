import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DossierLink } from "../types";

export function useDossierLinks(dossierId: string | null) {
  return useQuery({
    queryKey: ["dossier-links", dossierId],
    enabled: !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_links")
        .select("*")
        .eq("dossier_id", dossierId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DossierLink[];
    },
  });
}

export function useCreateDossierLink() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { dossier_id: string; linked_type: string; linked_id: string }) => {
      const { data, error } = await supabase
        .from("dossier_links")
        .insert(input)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as DossierLink;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dossier-links", vars.dossier_id] });
      toast.success("Verknüpfung erstellt");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}

export function useDeleteDossierLink() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dossierId }: { id: string; dossierId: string }) => {
      const { error } = await supabase.from("dossier_links").delete().eq("id", id);
      if (error) throw error;
      return dossierId;
    },
    onSuccess: (dossierId) => {
      qc.invalidateQueries({ queryKey: ["dossier-links", dossierId] });
      toast.success("Verknüpfung entfernt");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}
