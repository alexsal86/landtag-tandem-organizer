import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import type { DossierStakeholder, StakeholderStance } from "../types";

export function useDossierStakeholders(dossierId: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossier-stakeholders", dossierId, tenantId],
    enabled: !!tenantId && !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_stakeholders")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("dossier_id", dossierId!)
        .order("influence", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DossierStakeholder[];
    },
  });
}

export function useUpsertStakeholder() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  return useMutation({
    mutationFn: async (input: {
      id?: string;
      dossier_id: string;
      contact_id: string;
      stance: StakeholderStance;
      influence: number;
      note?: string | null;
      last_touch_at?: string | null;
    }) => {
      if (!currentTenant?.id || !profileId) throw new Error("Nicht angemeldet");
      const payload = {
        ...input,
        tenant_id: currentTenant.id,
        created_by: profileId,
      };
      const { error } = await supabase
        .from("dossier_stakeholders")
        .upsert(payload, { onConflict: "dossier_id,contact_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-stakeholders"] });
      toast.success("Akteur gespeichert");
    },
    onError: (err: Error) => toast.error(`Fehler: ${err.message}`),
  });
}

export function useDeleteStakeholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dossier_stakeholders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-stakeholders"] });
      toast.success("Akteur entfernt");
    },
    onError: (err: Error) => toast.error(`Fehler: ${err.message}`),
  });
}
