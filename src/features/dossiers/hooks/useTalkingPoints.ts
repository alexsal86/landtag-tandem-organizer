import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import type { DossierTalkingPoint, TalkingPointsContent } from "../types";

export function useTalkingPoints(dossierId: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossier-talking-points", dossierId, tenantId],
    enabled: !!tenantId && !!dossierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossier_talking_points")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("dossier_id", dossierId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, any>) => ({
        ...row,
        content: (row.content ?? {}) as TalkingPointsContent,
      })) as DossierTalkingPoint[];
    },
  });
}

export function useUpsertTalkingPoint() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  return useMutation({
    mutationFn: async (input: {
      id?: string;
      dossier_id: string;
      title?: string | null;
      content: TalkingPointsContent;
      for_appointment_id?: string | null;
      valid_until?: string | null;
    }) => {
      if (!currentTenant?.id || !profileId) throw new Error("Nicht angemeldet");
      if (input.id) {
        const { error } = await supabase
          .from("dossier_talking_points")
          .update({
            title: input.title ?? null,
            content: input.content,
            for_appointment_id: input.for_appointment_id ?? null,
            valid_until: input.valid_until ?? null,
          })
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      } else {
        const { data, error } = await supabase
          .from("dossier_talking_points")
          .insert({
            dossier_id: input.dossier_id,
            tenant_id: currentTenant.id,
            title: input.title ?? null,
            content: input.content,
            for_appointment_id: input.for_appointment_id ?? null,
            valid_until: input.valid_until ?? null,
            created_by: profileId,
          })
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return data?.id;
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["dossier-talking-points", vars.dossier_id] });
      toast.success("Sprechzettel gespeichert");
    },
    onError: (err: Error) => toast.error(`Fehler: ${err.message}`),
  });
}

export function useDeleteTalkingPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dossier_talking_points").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-talking-points"] });
      toast.success("Sprechzettel gelöscht");
    },
    onError: (err: Error) => toast.error(`Fehler: ${err.message}`),
  });
}
