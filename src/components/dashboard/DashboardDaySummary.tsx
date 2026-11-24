import { needsOwnDecision } from "@/components/my-work/decisions/types";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useAppointmentFeedback } from "@/hooks/useAppointmentFeedback";
import { useMyWorkDecisionsData } from "@/hooks/useMyWorkDecisionsData";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { STALE_TIME } from "@/lib/query-cache";
import { supabase } from "@/integrations/supabase/client";
import { appointmentSummary, pendingSummary } from "@/utils/dashboard/daySummary";
import { useAlerts as useAppointmentChangeAlerts } from "@/features/appointments/change-alerts/AppointmentChangeAlerts";
import { applyReportedStart, summarizeReportedChanges } from "@/features/appointments/change-alerts/changeModel";

export function DashboardDaySummary() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const feedback = useAppointmentFeedback();
  const decisions = useMyWorkDecisionsData(user?.id);
  const { data: changeAlerts = [] } = useAppointmentChangeAlerts();
  useDashboardRealtime(user?.id, currentTenant?.id);
  const schedule = useQuery({
    queryKey: ["dashboard-day-summary", currentTenant?.id],
    enabled: !!currentTenant?.id,
    staleTime: STALE_TIME.LIST_WITH_REALTIME,
    // Kein Polling: useDashboardRealtime oben invalidiert diesen Key bei Änderungen an
    // appointments und external_events.
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 86400_000).toISOString();
      const [internal, external] = await Promise.all([
        supabase.from("appointments").select("id,title,start_time,end_time,is_all_day,briefing_status,status")
          .eq("tenant_id", currentTenant!.id).or("category.is.null,category.neq.birthday").gte("end_time", since).order("start_time"),
        supabase.from("external_events").select("id,title,start_time,end_time,all_day,external_calendars!inner(tenant_id)")
          .eq("external_calendars.tenant_id", currentTenant!.id).gte("end_time", since).order("start_time"),
      ]);
      if (internal.error) throw internal.error;
      if (external.error) throw external.error;
      return [
        ...(internal.data ?? []).filter(event => !["cancelled", "canceled"].includes(event.status ?? "")),
        ...(external.data ?? []).map(event => ({ ...event, is_all_day: event.all_day ?? false })),
      ];
    },
  });
  const scheduleEvents = useMemo(
    () => (schedule.data ?? []).map(event => {
      const reportedStart = summarizeReportedChanges(changeAlerts, event.id).newStartTime;
      return reportedStart ? applyReportedStart(event, reportedStart) : event;
    }),
    [schedule.data, changeAlerts],
  );
  if (!user || !currentTenant) return null;
  if (schedule.isPending || decisions.loading || feedback.isLoading) {
    return <p className="text-title font-normal text-muted-foreground" role="status">Dein Tagesüberblick wird geladen…</p>;
  }
  const pendingDecisions = decisions.decisions.filter(decision => needsOwnDecision(decision)).length;
  const hasError = schedule.isError || Boolean(decisions.error) || feedback.isError;
  const retryAll = () => {
    void schedule.refetch();
    void decisions.refetch();
    feedback.refetch();
  };
  const emphasize = (text: string) => text.split(/(„[^“]+“|(?:[Ee]ine?|\d+) (?:Termine?|Entscheidung(?:en)?|Rückmeldungen?|Briefings?))/g)
    .map((part, index) => index % 2 ? <strong key={index} className="font-medium text-foreground">{part}</strong> : part);
  return (
    <div className="max-w-5xl text-title font-normal text-muted-foreground" aria-live="polite">
      <p>{schedule.isError ? "Termine konnten nicht geladen werden." : emphasize(appointmentSummary(scheduleEvents, now))}</p>
      <p>{decisions.error || feedback.isError ? "Offene Entscheidungen und Rückmeldungen konnten nicht vollständig geladen werden."
        : emphasize(pendingSummary(pendingDecisions, feedback.pendingFeedbackCount))}</p>
      {hasError && (
        <Button size="sm" variant="outline" onClick={retryAll} className="mt-space-2xs">
          <RefreshCw className="h-4 w-4 mr-space-2xs" aria-hidden="true" />
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}
