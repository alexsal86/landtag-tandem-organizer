import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { caseSourceHref } from "@/features/cases/items/appointmentLink";
import { workflowEvents } from "@/features/cases/items/workflow";

export function useCaseWorkflow(itemId: string | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["case-workflow", tenantId, itemId],
    enabled: !!tenantId && !!itemId,
    staleTime: 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      const [caseResult, requestResult, decisionResult, historyResult] = await Promise.all([
        supabase.from("case_items").select("meeting_id, pending_for_jour_fixe").eq("tenant_id", tenantId!).eq("id", itemId!).single(),
        supabase.from("appointment_requests").select("id, status, requested_date, created_at, decided_at, appointment_id, notes").eq("tenant_id", tenantId!).ilike("notes", `%caseItemId=${itemId}%`).order("created_at", { ascending: false }),
        supabase.from("task_decisions").select("id, title, status, created_at, updated_at, task_decision_participants(id, task_decision_responses(id, response_type, comment, created_at, updated_at))").eq("tenant_id", tenantId!).eq("case_item_id", itemId!).order("created_at", { ascending: false }),
        supabase.from("meeting_agenda_items").select("id, meeting_id, result_text, updated_at").eq("system_type", "case_items").ilike("result_text", `%${itemId}%`),
      ]);
      for (const result of [caseResult, requestResult, decisionResult, historyResult]) if (result.error) throw result.error;
      const linked = caseResult.data!;
      const requests = (requestResult.data ?? []).filter((request) => caseSourceHref(request.notes) === `/mywork?tab=cases&caseItemId=${itemId}`);
      const decisions = decisionResult.data ?? [];
      const agenda = historyResult.data ?? [];
      const meetingIds = [...new Set([linked.meeting_id, ...agenda.map((row) => row.meeting_id)].filter((id): id is string => !!id))];
      const meetings = meetingIds.length ? await supabase.from("meetings").select("id, title, meeting_date, status, updated_at").eq("tenant_id", tenantId!).in("id", meetingIds) : { data: [], error: null };
      if (meetings.error) throw meetings.error;
      const rows = meetings.data ?? [];
      // Ignore agenda rows whose parent meeting is not visible in this tenant.
      const visibleAgenda = agenda.filter((row) => rows.some((meeting) => meeting.id === row.meeting_id));
      return { requests, decisions, meetings: rows, agenda: visibleAgenda, meetingId: linked.meeting_id, pendingMeeting: linked.pending_for_jour_fixe,
        events: workflowEvents(itemId!, requests, decisions, rows, visibleAgenda) };
    },
  });
  useEffect(() => {
    if (!itemId || !tenantId) return;
    const refresh = () => { void client.invalidateQueries({ queryKey: ["case-workflow", tenantId, itemId] }); };
    let channel = supabase.channel(`case-workflow-${itemId}`);
    for (const table of ["appointment_requests", "task_decisions", "meetings", "case_items"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `tenant_id=eq.${tenantId}` }, refresh);
    }
    for (const table of ["meeting_agenda_items", "task_decision_participants", "task_decision_responses"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [client, itemId, tenantId]);
  return query;
}
