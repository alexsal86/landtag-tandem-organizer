import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import type { DossierEntry } from "../types";

/** Entry-followups across all dossiers, due in the next N days (or overdue) */
export function useEntryFollowups(daysAhead: number = 14) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["dossier-entry-followups", tenantId, daysAhead],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const until = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("dossier_entries")
        .select("*")
        .eq("tenant_id", tenantId!)
        .not("followup_at", "is", null)
        .lte("followup_at", until)
        .order("followup_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as DossierEntry[];
    },
  });
}

export function useUpdateEntryFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, followupAt }: { entryId: string; followupAt: string | null }) => {
      const { error } = await supabase
        .from("dossier_entries")
        .update({ followup_at: followupAt })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-entry-followups"] });
      qc.invalidateQueries({ queryKey: ["dossier-entries"] });
      toast.success("Wiedervorlage aktualisiert");
    },
    onError: (err: Error) => toast.error(`Fehler: ${err.message}`),
  });
}
