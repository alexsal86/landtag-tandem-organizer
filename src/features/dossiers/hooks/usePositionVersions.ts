import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import type { DossierPositionVersion } from "../types";

export function usePositionVersions(dossierId: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossier-position-versions", dossierId, tenantId],
    enabled: !!tenantId && !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_position_versions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("dossier_id", dossierId!)
        .order("valid_from", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DossierPositionVersion[];
    },
  });
}

export function useCreatePositionVersion() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  return useMutation({
    mutationFn: async (input: { dossier_id: string; content_html: string; change_reason?: string }) => {
      if (!currentTenant?.id || !profileId) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("dossier_position_versions").insert({
        dossier_id: input.dossier_id,
        tenant_id: currentTenant.id,
        content_html: input.content_html,
        change_reason: input.change_reason ?? null,
        created_by: profileId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["dossier-position-versions", vars.dossier_id] });
      toast.success("Position archiviert");
    },
    onError: (err: Error) => toast.error(`Fehler: ${err.message}`),
  });
}
