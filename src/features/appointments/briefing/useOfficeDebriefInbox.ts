import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { stripHtml } from "@/utils/textDiff";
import { notify } from "@/lib/notify";
import type { DebriefEvent, DebriefReport } from "./officeDebriefInbox";

type Update = Omit<Database["public"]["Functions"]["update_office_debrief"]["Args"], "_tenant">;

export function useOfficeDebriefInbox(deputy: boolean, enabled = true) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenant = currentTenant?.id;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["office-debriefs", tenant, user?.id, deputy],
    enabled: enabled && !!tenant && !!user?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_office_debriefs", { _tenant: tenant!, _deputy_view: deputy });
      if (error) throw error;
      const inbox = data as unknown as { reports: DebriefReport[]; missing: DebriefEvent[] };
      return { ...inbox, reports: inbox.reports.map(report => ({
        ...report, notes: /<[a-z][^>]*>/i.test(report.notes) ? stripHtml(report.notes) : report.notes,
      })) };
    },
  });
  const update = useMutation({
    mutationFn: async (args: Update) => {
      if (!tenant) throw new Error("Bitte ein Büro wählen.");
      const { error } = await supabase.rpc("update_office_debrief", { _tenant: tenant, ...args });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["office-debriefs", tenant] }),
        queryClient.invalidateQueries({ queryKey: ["appointment-feedback-appointments", user?.id, tenant] }),
        queryClient.invalidateQueries({ queryKey: ["appointment-feedback-external", user?.id, tenant] }),
        queryClient.invalidateQueries({ queryKey: ["team-feedback-feed", tenant] }),
      ]);
    },
    onError: (error) => {
      notify.error("Nachbereitung konnte nicht gespeichert werden.", { description: error.message });
      void queryClient.invalidateQueries({ queryKey: ["office-debriefs", tenant] });
    },
  });
  return { query, update };
}
