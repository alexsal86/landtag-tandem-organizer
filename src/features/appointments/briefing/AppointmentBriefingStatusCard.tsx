import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { notify } from "@/lib/notify";
import { asBriefingStatus, BRIEFING_STATUS_LABELS, canAdvanceBriefing, type BriefingAction } from "../briefing";
import { useAppointmentBriefing, useBriefingMutations } from "./useBriefing";
import { BriefingRequestPopover } from "./BriefingRequestPopover";
import { CompactBriefingEditor } from "./CompactBriefingEditor";
import { canGoLive } from "./briefingModel";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const VARIANT: Record<string, "secondary" | "outline" | "default"> = { undecided: "outline", none: "secondary", assigned: "default", in_review: "default", approved: "secondary", completed: "secondary" };

/** Briefing tile in the appointment sidebar. Server enforces roles; UI hides decider buttons optimistically. */
export function AppointmentBriefingStatusCard({ appointmentId, title, startTime, isDecider }: { appointmentId: string; title: string; startTime: string; isDecider: boolean }) {
  const { user } = useAuth();
  const { users } = useTenantUsers();
  const { data } = useAppointmentBriefing(appointmentId);
  const { setBriefing, advance } = useBriefingMutations();
  const [editorOpen, setEditorOpen] = useState(false);
  const navigate = useNavigate();
  if (!data) return null;
  const goLive = async () => {
    const { data: prep } = await supabase.from("appointment_preparations").select("id").eq("appointment_id", appointmentId).eq("is_archived", false).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!prep) { notify.error("Für diesen Termin gibt es noch kein Briefing."); return; }
    navigate(`/briefing-live?preparationId=${prep.id}&appointmentId=${appointmentId}`);
  };
  const status = asBriefingStatus(data.briefing_status);
  const assigneeName = users.find((u) => u.id === data.briefing_assignee_id)?.display_name;
  const isAssignee = data.briefing_assignee_id === user?.id;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); notify.success(ok); } catch (e) { notify.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen."); }
  };
  const act = (action: BriefingAction, ok: string) => run(() => advance.mutateAsync({ appointmentId, action }), ok);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-label font-medium"><FileText className="h-4 w-4 text-muted-foreground" />Briefing</span>
        <Badge variant={VARIANT[status]}>{BRIEFING_STATUS_LABELS[status]}</Badge>
      </div>
      {(status === "assigned" || status === "in_review") && (
        <p className="text-caption text-muted-foreground">
          {assigneeName ?? "Zuarbeit"}{data.briefing_due_at && ` · Frist ${format(new Date(data.briefing_due_at), "EEE d.M. HH:mm", { locale: de })}`}
        </p>
      )}
      {data.briefing_instructions && status !== "none" && <p className="text-caption">{data.briefing_instructions}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "undecided" && isDecider && (
          <>
            <Button size="sm" variant="outline" onClick={() => run(() => setBriefing.mutateAsync({ appointmentId, decision: "none" }), "Kein Briefing nötig.")}>Kein Briefing nötig</Button>
            <BriefingRequestPopover appointmentId={appointmentId} startTime={startTime} trigger={<Button size="sm">Briefing anfordern</Button>} />
          </>
        )}
        {status === "none" && isDecider && (
          <BriefingRequestPopover appointmentId={appointmentId} startTime={startTime} trigger={<Button size="sm" variant="ghost">Doch Briefing anfordern</Button>} />
        )}
        {status !== "undecided" && status !== "none" && <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>Briefing öffnen</Button>}
        {canGoLive({ briefing_status: status, start_time: startTime }) && <Button size="sm" onClick={goLive}>Live starten</Button>}
        {canAdvanceBriefing(status, "submit", { isDecider, isAssignee }) && <Button size="sm" onClick={() => act("submit", "Zur Freigabe vorgelegt.")}>Zur Freigabe vorlegen</Button>}
        {canAdvanceBriefing(status, "approve", { isDecider, isAssignee }) && <Button size="sm" onClick={() => act("approve", "Briefing freigegeben.")}>Freigeben</Button>}
        {canAdvanceBriefing(status, "return", { isDecider, isAssignee }) && <Button size="sm" variant="outline" onClick={() => act("return", "Zurück an Zuarbeit.")}>Zurück mit Anmerkung</Button>}
        {status === "assigned" && isDecider && (
          <Button size="sm" variant="ghost" onClick={() => run(() => setBriefing.mutateAsync({ appointmentId, decision: "none" }), "Briefing abbestellt.")}>Doch kein Briefing</Button>
        )}
      </div>
      <CompactBriefingEditor open={editorOpen} onOpenChange={setEditorOpen} appointmentId={appointmentId} title={title} />
    </div>
  );
}
